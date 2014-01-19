#! /usr/bin/env node

var fs = require("fs"),
    xlsx = require("xlsx"),
    _ = require("underscore"),
    csv = require("csv"),
    request = require("request");

var inputFile = "data/processed/life_expectancy.json",
    outputFileJson = "data/processed/life_expectancy_enriched.json",
    outputFileCsv  = "data/processed/life_expectancy_enriched.csv";

var readJson = function(filename) {
  return JSON.parse(fs.readFileSync(filename));
};

var getGssCodes = function(jsonObj) {
  return _.map(_.keys(jsonObj), function(k) {
    return jsonObj[k].codes.gss;
  });
};

console.log("Enriching life expectancy data with area info from mapit.mysociety.org...");
console.log("(this can take a while...)");

//request.setMaxListeners(0);

var data = readJson(inputFile);

var enrichedCounter = 0;

_.each(data, function(life) {
  var url = "http://mapit.mysociety.org/area/"+life.code;
  request(url, function(err, res, body) {
    if (err)
      throw err;
    var jsonData = JSON.parse(body);
    if (!jsonData) {
      console.log("Couldn't parse body to JSON");
      console.log(res);
    }

    life.area_id = jsonData.id;
    life.area_mapit_name = jsonData.name;
    life.area_type = jsonData.type;

    // fetch 'areas covered by this area'
    var coversUrl = "http://mapit.mysociety.org/area/"+life.area_id+"/covers?type=WMC"
    request(coversUrl, function(err, res, body) {
      if (err)
        throw err;
      var jsonCovers = JSON.parse(body);
      life.area_covers = getGssCodes(jsonCovers);

      // fetch 'areas this area overlaps'
      var overlapsUrl = "http://mapit.mysociety.org/area/"+life.area_id+"/overlaps?type=WMC"
      request(overlapsUrl, function(err, res, body) {
        if (err)
          throw err;
        var jsonOverlaps = JSON.parse(body);
        life.area_overlaps = getGssCodes(jsonOverlaps);

        enrichedCounter += 1;

        if (enrichedCounter == data.length) {
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

          console.log("Data for " + data.length + " areas enriched");
        }
      });
    });
  });
});

