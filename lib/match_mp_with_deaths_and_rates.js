#! /usr/bin/env node

var fs = require("fs"),
    xlsx = require("xlsx"),
    _ = require("underscore"),
    csv = require("csv"),
    request = require("request");

var inputFileMPs = "data/processed/sexymp_enriched.json",
    inputFileDeath= "data/processed/deaths_and_rates_enriched.json",
    outputFileJson = "data/processed/mp_with_deaths_and_rates.json",
    outputFileCsv  = "data/processed/mp_with_deaths_and_rates.csv";

var readJson = function(filename) {
  return JSON.parse(fs.readFileSync(filename));
};

console.log("Mapping MPs with deaths and rates data...");

var mpData = readJson(inputFileMPs);
var deathData = readJson(inputFileDeath);

var deathCodeMap = {};
var deathCoveredByMap = {};
var deathOverlappedByMap = {};
_.each(deathData, function(death) {
  deathCodeMap[death.code] = death;
  _.each(death.area_covers, function(covered) {
    var as = deathCoveredByMap[covered] || [];
    as.push(death);
    deathCoveredByMap[covered] = as;
  });
  _.each(death.area_overlaps, function(overlapped) {
    var as = deathOverlappedByMap[overlapped] || [];
    as.push(death);
    deathOverlappedByMap[overlapped] = as;
  });
});

var manuallyAddPerfectMatch = function(from, to, note) {
  console.log(">> Manually adding perfect match for '"+from+"' to '"+to+"'. Mapit fails to gather this for us. ("+note+")");
  var death = deathCodeMap[to];
  if (!death) throw "fail!";
  deathCodeMap[from] = death;
  console.log(death)
};
var manuallyAddCoveredByMatch = function(from, to, note) {
  console.log(">> Manually adding covered_by match for '"+from+"' to '"+to+"'. Mapit fails to gather this for us. ("+note+")");
  var death = deathCodeMap[to];
  if (!death) throw "fail!";
  var as = deathCoveredByMap[from] || [];
  as.push(death);
  deathCoveredByMap[from] = as;
};


var manuallyAddOverlappedByMatch = function(from, tos, note) {
  console.log(">> Manually adding covered_by match for '"+from+"' to '"+tos+"'. Mapit fails to gather this for us. ("+note+")");
  _.each(tos, function(to) {
    var death = deathCodeMap[to];
    if (!death) throw "fail!";
    var as = deathCoveredByMap[from] || [];
    as.push(death);
    deathCoveredByMap[from] = as;
  });
};

manuallyAddPerfectMatch("S14000005", "S12000035", "Argyll & Bute");
manuallyAddCoveredByMatch("S14000027", "S12000013", "Na h-Eileanan an Iar (Eilan Siar");
manuallyAddCoveredByMatch("S14000039", "S15000001", "Inverness... < Scotland");
manuallyAddCoveredByMatch("S14000055", "S15000001", "Ross, Skye and Lochaber < Scotland");
manuallyAddCoveredByMatch("S14000009", "S15000001", "Caithness, Sutherland and Easter Ross < Scotland");
manuallyAddOverlappedByMatch("S14000051", ["S12000023", "S12000027"], "'Orkney and Shetland' is covered by Orkney Islands and Shetland Islands");


var orderedAreaTypes = ["DIS", "UTA", "CTY", "LBO", "LGD", "MTD", "EUR"];//,"UTA","LGD","CTY","MTD","LBO"];
var death_data_keys = [
  "population_total",
  "population_male",
  "population_female",
  "deaths_num_total",
  "deaths_num_male",
  "deaths_num_female",
  "deaths_num_infant",
  "deaths_num_neonatal",
  "deaths_num_perinatal",
  "deaths_rate_crude",
  "deaths_rate_agestd_total",
  "deaths_rate_agestd_male",
  "deaths_rate_agestd_female",
  "deaths_rate_infant",
  "deaths_rate_neonatal",
  "deaths_rate_perinatal",
  ];

var extractDeathData = function(death) {
  return _.pick(death, death_data_keys);
}

var avgDeathData = function(deaths) {
  var r = {};
  var len = deaths.length;
  _.each(death_data_keys, function(k) {
    var v = 0;
    _.each(deaths, function(death) {
      v += death[k];
    });
    r[k] = v / len;
  });
  return r;
};


var findMatchingDeathData = function(area_code) {
  if (deathCodeMap[area_code]) {
    var death = deathCodeMap[area_code];
    var r = extractDeathData(death);
    r.match_type = "perfect";
    r.matched_by = [death.code];
    return r;
  }
  if (deathCoveredByMap[area_code]) {
    areas = deathCoveredByMap[area_code];
    var death = null;
    if (areas.length == 1) {
      var death = areas[0];
    } else {
      // find smallest area
      var weird = _.find(areas, function(a) { return a.area_type != "DIS" && a.area_type != "CTY" && a.area_type != "EUR" && a.area_type != "UTA" && a.area_type != "MTD"; });
      if (weird) {
        console.log(areas);
        console.log("weird: ");
        console.log(weird);
        throw "found weird area"
      }
      _.each(orderedAreaTypes, function(atype) {
        if (death)
          return;
        death = _.find(areas, function(a) { return a.area_type == atype; });
      });
      if (!death) {
        console.log(areas);
        throw "unknown type of death";
      }
    }
    var r = extractDeathData(death);
    r.match_type = "covered_by";
    r.matched_by = [death.code];
    return r;
  }
  if (deathOverlappedByMap[area_code]) {
    areas = deathOverlappedByMap[area_code];
    r = avgDeathData(areas);
    r.match_type = "overlapped_by (calculated average)";
    r.matched_by = _.pluck(areas, "code");
    return r;
  }
  return null;
};

var generateDummyDeathData = function(reason) {
  var r = {};
  _.each(death_data_keys, function(k) {
    r[k] = 0;
  });
  r.match_type = reason;
  r.matched_by = [];
  return r;
};



var noPolys = ["N06000012", "N06000006", "N06000009", "N06000008", "N06000013",
    "N06000002", "N06000017", "N06000015", "N06000007", "N06000003", "N06000014",
    "N06000001", "N06000011", "N06000010", "N06000016", "N06000005", "N06000018"];
var mpAreaHasNoPolygons = function(code) {
  return _.contains(noPolys, code);
}

var data = []
var ok = 0, fail = 0;
_.each(mpData, function(mp) {
  var str = mp.name + ", " + mp.area_mapit_name + ", " + mp.area_gss_code;
  var death = findMatchingDeathData(mp.area_gss_code);
  if (!death) {
    if (mpAreaHasNoPolygons(mp.area_gss_code)) {
      console.log("== Data unavailable for " + str + ". Her/his area has no polygons on mapit.mysociety.org.");
      var death = generateDummyDeathData("no match (no polygons)");
      data.push(_.defaults(mp, death));
      ok += 1;
    } else {
      console.log("-- Could not find match for " + str);
      var death = generateDummyDeathData("no match");
      data.push(_.defaults(mp, death));
      fail += 1;
    }
  } else {
    console.log("++ Could find match for " + str + ". Type: " + death.match_type);
    data.push(_.defaults(mp, death));
    ok += 1;
  }
});

if (data.length != mpData.length)
  throw "data length does not match mpData length";

console.log("== Ok: " + ok);
console.log("== Fail: " + fail);

// Write to files
var jsonString = JSON.stringify(data, null, 2);
fs.writeFileSync(outputFileJson, jsonString);
csv().from(data).to.options({
  quoted: true,
  delimiter: ',',
  columns: _.keys(data[0]),
  header: true
}).to.string(function(csvString) {
  csvString = "sep=,\n" + csvString;
  fs.writeFileSync(outputFileCsv, csvString);
});

console.log("Data for " + data.length + " MPs mapped");

