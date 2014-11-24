#! /usr/bin/env node

var fs = require("fs"),
    xlsx = require("xlsx"),
    _ = require("underscore"),
    csv = require("csv"),
    request = require("request");

var inputFileMPs = "data/processed/sexymp_enriched.json",
    inputFileLife= "data/processed/life_expectancy_enriched.json",
    outputFileJson = "data/processed/mp_with_life_expectancy.json",
    outputFileCsv  = "data/processed/mp_with_life_expectancy.csv";

var readJson = function(filename) {
  return JSON.parse(fs.readFileSync(filename));
};

console.log("Mapping MPs with life expectancy data...");

var mpData = readJson(inputFileMPs);
var lifeData = readJson(inputFileLife);

var lifeCodeMap = {};
var lifeCoveredByMap = {};
var lifeOverlappedByMap = {};
_.each(lifeData, function(life) {
  lifeCodeMap[life.code] = life;
  _.each(life.area_covers, function(covered) {
    var as = lifeCoveredByMap[covered] || [];
    as.push(life);
    lifeCoveredByMap[covered] = as;
  });
  _.each(life.area_overlaps, function(overlapped) {
    var as = lifeOverlappedByMap[overlapped] || [];
    as.push(life);
    lifeOverlappedByMap[overlapped] = as;
  });
});

var life_data_keys = [
      "life_exp_birth_male_years",
      "life_exp_birth_male_rank",
      "life_exp_birth_female_years",
      "life_exp_birth_female_rank",
      "life_exp_65_male_years",
      "life_exp_65_male_rank",
      "life_exp_65_female_years",
      "life_exp_65_female_rank"
      ];

var extractLifeData = function(life) {
  return _.pick(life, life_data_keys);
}

var avgLifeData = function(lifes) {
  var r = {};
  var len = lifes.length;
  _.each(life_data_keys, function(k) {
    var v = 0;
    _.each(lifes, function(life) {
      v += life[k];
    });
    r[k] = v / len;
  });
  return r;
};


var findMatchingLifeData = function(area_code) {
  if (lifeCodeMap[area_code]) {
    var life = lifeCodeMap[area_code];
    var r = extractLifeData(life);
    r.match_type = "perfect";
    r.matched_by = [life.code];
    return r;
  }
  if (lifeCoveredByMap[area_code]) {
    areas = lifeCoveredByMap[area_code];
    if (areas.length != 1)
      throw "Unexpected covered-by length for " + area_code + ": " + areas.length;
    var life = areas[0];
    var r = extractLifeData(life);
    r.match_type = "covered_by";
    r.matched_by = [life.code];
    return r;
  }
  if (lifeOverlappedByMap[area_code]) {
    areas = lifeOverlappedByMap[area_code];
    r = avgLifeData(areas);
    r.match_type = "overlapped_by (calculated average)";
    r.matched_by = _.pluck(areas, "code");
    return r;
  }
  return null;
};

var generateDummyLifeData = function(reason) {
  var r = {};
  _.each(life_data_keys, function(k) {
    r[k] = 0;
  });
  r.match_type = reason;
  r.matched_by = [];
  return r;
};



//throw "stop";

var data = []
var ok = 0, fail = 0;
_.each(mpData, function(mp) {
  var str = mp.name + ", " + mp.area_mapit_name + ", " + mp.area_gss_code;
  if (mp.country == "Scotland" || mp.country == "Northern Ireland") {
    console.log("== Data unavailable for " + mp.country + " " + str);
    var life = generateDummyLifeData("no match ("+mp.country+" unavailable)");
    data.push(_.defaults(mp, life));
    ok += 1;
  } else {
    var life = findMatchingLifeData(mp.area_gss_code);
    if (!life) {
      console.log("-- Could not find match for " + str);
      var life = generateDummyLifeData("no match");
      data.push(_.defaults(mp, life));
      fail += 1;
    } else {
      console.log("++ Could find match for " + str + ". Type: " + life.match_type);
      data.push(_.defaults(mp, life));
      ok += 1;
    }
  }
});

if (data.length != mpData.length)
  throw "data length does not match mpData length";

console.log("Ok: " + ok);
console.log("Fail: " + fail);

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
