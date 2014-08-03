#! /usr/bin/env node

var fs = require("fs"),
    xlsx = require("xlsx"),
    _ = require("underscore"),
    csv = require("csv"),
    request = require("request");

var inputFileMPs = "data/processed/sexymp_enriched.json",
    inputFileIM= "data/infant_mortality/processed/all_enriched.json",
    outputFile = "data/infant_mortality/processed/mp_with_infant_mortality";

var readJson = function(filename) {
  return JSON.parse(fs.readFileSync(filename));
};

console.log("Mapping MPs with infant mortality data...");


var mpData = readJson(inputFileMPs);
var imData = readJson(inputFileIM);


var imCodeMap = {};
var imCoveredByMap = {};
var imOverlappedByMap = {};
_.each(imData, function(im) {
  imCodeMap[im.code] = im;
  _.each(im.area_covers, function(covered) {
    var as = imCoveredByMap[covered] || [];
    as.push(im);
    imCoveredByMap[covered] = as;
  });
  _.each(im.area_overlaps, function(overlapped) {
    var as = imOverlappedByMap[overlapped] || [];
    as.push(im);
    imOverlappedByMap[overlapped] = as;
  });
});

var manuallyAddPerfectMatch = function(from, to, note) {
  console.log(">> Manually adding perfect match for '"+from+"' to '"+to+"'. Mapit fails to gather this for us. ("+note+")");
  var im = imCodeMap[to];
  if (!im) throw "fail!";
  imCodeMap[from] = im;
  console.log(im)
};

var manuallyAddCoveredByMatch = function(from, to, note) {
  console.log(">> Manually adding covered_by match for '"+from+"' to '"+to+"'. Mapit fails to gather this for us. ("+note+")");
  var im = imCodeMap[to];
  if (!im) throw "fail!";
  var as = imCoveredByMap[from] || [];
  as.push(im);
  imCoveredByMap[from] = as;
};

var manuallyAddOverlappedByMatch = function(from, tos, note) {
  console.log(">> Manually adding covered_by match for '"+from+"' to '"+tos+"'. Mapit fails to gather this for us. ("+note+")");
  _.each(tos, function(to) {
    var im = imCodeMap[to];
    if (!im) throw "fail!";
    var as = imCoveredByMap[from] || [];
    as.push(im);
    imCoveredByMap[from] = as;
  });
};


var orderedAreaTypes = ["DIS", "UTA", "CTY", "LBO", "LGD", "MTD", "EUR"];//,"UTA","LGD","CTY","MTD","LBO"];
var im_data_keys = [
  "06_infant_mortality",
  "07_infant_mortality",
  "08_infant_mortality",
  "09_infant_mortality",
  ];
var extractImData = function(im) {
  return _.pick(im, im_data_keys);
}

var avgImData = function(ims) {
  var r = {};
  var len = ims.length;
  _.each(im_data_keys, function(k) {
    var v = 0;
    _.each(ims, function(im) {
      v += im[k];
    });
    r[k] = v / len;
  });
  return r;
};


var findMatchingImData = function(area_code) {
  if (imCodeMap[area_code]) {
    var im = imCodeMap[area_code];
    var r = extractImData(im);
    r.match_type = "perfect";
    r.matched_by = [im.code];
    return r;
  }
  if (imCoveredByMap[area_code]) {
    areas = imCoveredByMap[area_code];
    var im = null;
    if (areas.length == 1) {
      var im = areas[0];
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
        if (im)
          return;
        im = _.find(areas, function(a) { return a.area_type == atype; });
      });
      if (!im) {
        console.log(areas);
        throw "unknown type of im";
      }
    }
    var r = extractImData(im);
    r.match_type = "covered_by";
    r.matched_by = [im.code];
    return r;
  }
  if (imOverlappedByMap[area_code]) {
    areas = imOverlappedByMap[area_code];
    r = avgImData(areas);
    r.match_type = "overlapped_by (calculated average)";
    r.matched_by = _.pluck(areas, "code");
    return r;
  }
  return null;
};

var generateDummyImData = function(reason) {
  var r = {};
  _.each(im_data_keys, function(k) {
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
  var im = findMatchingImData(mp.area_gss_code);
  if (!im) {
    if (mpAreaHasNoPolygons(mp.area_gss_code)) {
      console.log("== Data unavailable for " + str + ". Her/his area has no polygons on mapit.mysociety.org.");
      var im = generateDummyImData("no match (no polygons)");
      data.push(_.defaults(mp, im));
      ok += 1;
    } else {
      console.log("-- Could not find match for " + str);
      var im = generateDummyImData("no match");
      data.push(_.defaults(mp, im));
      fail += 1;
    }
  } else {
    console.log("++ Could find match for " + str + ". Type: " + im.match_type);
    data.push(_.defaults(mp, im));
    ok += 1;
  }
});

if (data.length != mpData.length)
  throw "data length does not match mpData length";

console.log("== Ok: " + ok);
console.log("== Fail: " + fail);

writeData(data, outputFile, _.keys(data[0]));


function writeData(data, filename, headers) {
  var jsonString = JSON.stringify(data, null, 2);
  fs.writeFileSync(filename + '.json', jsonString);
  console.log('Wrote JSON data to', filename + '.json');

  csv().from(data).to.options({
    quoted: true,
    delimiter: ',',
    header: !!headers,
    columns: headers
  }).to.string(function(csvString) {
    csvString = "sep=,\n" + csvString;
    fs.writeFileSync(filename + '.csv', csvString);
    console.log('Wrote CSV data to', filename + '.csv');
  });
}
