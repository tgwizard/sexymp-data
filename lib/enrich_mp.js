#! /usr/bin/env node

var fs = require("fs"),
    xlsx = require("xlsx"),
    _ = require("underscore"),
    csv = require("csv"),
    request = require("request");

var inputFile = "data/processed/sexymp.json",
    outputFileJson = "data/processed/sexymp_enriched.json",
    outputFileCsv  = "data/processed/sexymp_enriched.csv";

var readJson = function(filename) {
  return JSON.parse(fs.readFileSync(filename));
};

console.log("Enriching data for MPs with area info from mapit.mysociety.org...");

var data = readJson(inputFile);

var enrichedCounter = 0;

_.each(data, function(mp, i) {
  var name = mp.constituency;
  if (name.indexOf("!") != -1) {
    name = name.substring(0, name.indexOf("!"));
  }
  var url = "http://mapit.mysociety.org/areas/"+name+"?type=WMC";
  request(url, function(err, res, body) {
    if (err)
      throw err;
    var jsonData = JSON.parse(body);
    if (!jsonData) {
      console.log("Couldn't parse body to JSON");
      console.log(res);
    }
    var ks = _.keys(jsonData);
    var a = null;
    if (ks.length == 0)
      throw ("No responses for MP " + mp.name + ", const " + mp.constituency + ": " + body);
    if (ks.length == 1)
      a = jsonData[ks[0]];
    if (ks.length != 1) {
      _.each(ks, function(aks) {
        if (jsonData[aks].name == mp.constituency)
          a = jsonData[aks];
      });
      if (a == null) {
        console.log(jsonData);
        throw ("Unexpected number of responses for MP " + mp.name + ", const " + mp.constituency + ": " + ks);
      }
    }
    mp.area_gss_code = a.codes.gss;
    mp.area_id = a.id;
    mp.area_mapit_name = a.name;
    mp.country = a.country_name;
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

      console.log("Data for " + data.length + " MPs enriched");
    }
  });
});

