#! /usr/bin/env node

var fs = require("fs"),
    xlsx = require("xlsx"),
    _ = require("underscore"),
    csv = require("csv"),
    request = require("request");

var inputFile  = "data/infant_mortality/processed/all_enriched.json",
    outputFile = "data/infant_mortality/processed/all_area_layout_enriched";

console.log("Enriching data for infant mortality area LAYOUT with area info from mapit.mysociety.org...");

var data = JSON.parse(fs.readFileSync(inputFile));

var REQUEST_TIMEOUT = 1200; // We are only allowed an average of 1 req/s ("rolling over 3 minutes")

var enrichedCounter = 0, failedCounter = 0, ignoredCounter = 0;
var requestCounter = 0;
_.each(data, function(area, i) {
  var name = area.area_mapit_name;

  requestCounter += 1;
  setTimeout(function() {
    // fetch 'areas covered by this area'
    var coversUrl = "http://mapit.mysociety.org/area/"+area.area_id+"/covers?type=WMC";
    request(coversUrl, function(err, res, body) {
      if (err)
        throw err;
      if (res.statusCode == 200) {
        var jsonCovers = JSON.parse(body);
        area.area_covers = getGssCodes(jsonCovers);
      } else {
        console.log(">> Failed to fetch covered areas for '" + name + "'. Url: " + coversUrl + ". Response: " + body);
        area.area_covers = [];
      }

      requestCounter += 1;
      setTimeout(function() {
        // fetch 'areas this area overlaps'
        var overlapsUrl = "http://mapit.mysociety.org/area/"+area.area_id+"/overlaps?type=WMC";
        request(overlapsUrl, function(err, res, body) {
          if (err)
            throw err;
          if (res.statusCode == 200) {
            var jsonOverlaps = JSON.parse(body);
            area.area_overlaps = getGssCodes(jsonOverlaps);
          } else {
            console.log(">> Failed to fetch overlapped areas for '" + name + "'. Url: " + overlapsUrl + ". Response: " + body);
            area.area_overlaps = [];
          }

          enrichedCounter += 1;
          attemptToWriteData();
        });
      }, REQUEST_TIMEOUT*requestCounter);
    });
  }, REQUEST_TIMEOUT*requestCounter);
});

var getGssCodes = function(jsonObj) {
  return _.map(_.keys(jsonObj), function(k) {
    return jsonObj[k].codes.gss;
  });
};

var attemptToWriteData = function() {
  if (enrichedCounter + failedCounter + ignoredCounter == data.length) {
    console.log("Enriched areas: " + enrichedCounter);
    console.log("Failed areas: " + failedCounter);
    console.log("Ignored areas: " + ignoredCounter);

    writeData(data, outputFile, _.keys(data[0]));
  }
};

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
