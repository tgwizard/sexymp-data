#! /usr/bin/env node

var fs = require("fs"),
    xlsx = require("xlsx"),
    _ = require("underscore"),
    csv = require("csv"),
    request = require("request");

var inputFile = "data/processed/deaths_and_rates.json",
    outputFileJson = "data/processed/deaths_and_rates_enriched.json",
    outputFileCsv  = "data/processed/deaths_and_rates_enriched.csv";

var readJson = function(filename) {
  return JSON.parse(fs.readFileSync(filename));
};

var getGssCodes = function(jsonObj) {
  return _.map(_.keys(jsonObj), function(k) {
    return jsonObj[k].codes.gss;
  });
};

console.log("Enriching deaths and rates data with area info from mapit.mysociety.org...");
console.log("(this can take a while...)");

//request.setMaxListeners(0);

var data = readJson(inputFile);
var newData = [];

var enrichedCounter = 0, failedCounter = 0, ignoredCounter = 0;

var cleanLookupName = function(name) {
  return name.toLowerCase()
    .replace("scotland1", "scotland")
    .replace("york ua", "city of york")
    .replace("cornwall ua and isles of scilly ua3", "cornwall council")
    .replace("kingston upon hull‚ city of ua", "hull city council")
    .replace("rhondda‚ cynon‚ taff", "rhondda cynon taf")
    .replace("eilean siar", "comhairle nan eilean siar")
    .replace("edinburgh city of", "city of edinburgh")
    .replace("bristol, city of", "city of bristol")
    .replace("‚ county of ua", "")
    .replace("‚ city of ua", "")
    .replace(" ua", "")
    .replace("county ", "")
    .replace(" (met county)", "")
    .replace("southend on sea", "southend-on-sea")
    .replace("&", "and");
};
var cleanName = function(name) {
  return name.toLowerCase()
    .replace(" city council", "")
    .replace(" county council", "")
    .replace(" district council", "")
    .replace(" borough council", "")
    .replace(" council", "")
    .replace(" ua", "");
};

var namesToIgnore = ["united kingdom", "england", "england and wales2",
    "wales", "north west", "north east", "east", "greater manchester", "yorkshire",
    "east midlands", "west midlands", "london", "south east", "south west",
    "northern ireland1", "local government district",
    "outside england and wales", "council areas", "inner london",
    "hackney and city of london3", "outer london"];
var shouldIgnore = function(name) {
  return _.contains(namesToIgnore, name);
};

var attemptToWriteData = function() {
  if (enrichedCounter + failedCounter + ignoredCounter == data.length) {
    console.log("Enriched areas: " + enrichedCounter);
    console.log("Failed areas: " + failedCounter);
    console.log("Ignored areas: " + ignoredCounter);
    // Write to files
    var jsonString = JSON.stringify(newData, null, 2);
    fs.writeFileSync(outputFileJson, jsonString);
    csv().from(newData).to.options({
      quoted: true,
      delimiter: ',',
      columns: _.keys(newData[0]),
      header: true
    }).to.string(function(csvString) {
      csvString = "sep=,\n" + csvString;
      fs.writeFileSync(outputFileCsv, csvString);
    });

    console.log("Data for " + data.length + " areas enriched");
  }
};

var areaTypes = "EUR,UTA,DIS,LGD,CTY,MTD,LBO";
console.log("Area types used during lookup: " + areaTypes);

_.each(data, function(death) {
  var name = cleanLookupName(death.area_name);
  if (shouldIgnore(name)) {
    console.log("** Ignoring '" + name + "'. It doesn't make sense, or is a too general area.");
    ignoredCounter += 1;
    attemptToWriteData();
    return;
  }
  var url = "http://mapit.mysociety.org/areas/"+name+"?type="+areaTypes;
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
    if (ks.length == 0) {
      console.log("-- No result for '" + name + "'. Skipping it. Url: " + url);
      failedCounter += 1;
      attemptToWriteData();
      return;
    }
    if (ks.length == 1)
      a = jsonData[ks[0]];
    if (ks.length != 1) {
      var dn = cleanName(death.area_name);
      var failedAns = [];
      _.each(ks, function(aks) {
        if (jsonData[aks].type == "WMC") {
          a = jsonData[aks];
        }
      });
      if (a == null) {
        _.each(ks, function(aks) {
          var an = cleanName(jsonData[aks].name);
          if (an == dn) {
            a = jsonData[aks];
          } else {
            failedAns.push(an);
          }
        });
        if (a == null) {
          console.log("-- Too many results for '" + name + "', probably due to too generic area. Skipping it. Url: " + url);
          console.log(">> Failed '" + dn + "' for ans: " + failedAns);
          console.log(jsonData);
          failedCounter += 1;
          attemptToWriteData();
          return;
        }
      }
    }
    //console.log("++ " + name);

    newData.push(death);

    death.code = a.codes.gss || "code_missing";
    death.area_id = a.id;
    death.area_mapit_name = a.name;
    death.area_type = a.type;

    // fetch 'areas covered by this area'
    var coversUrl = "http://mapit.mysociety.org/area/"+death.area_id+"/covers?type=WMC"
    request(coversUrl, function(err, res, body) {
      if (err)
        throw err;
      if (res.statusCode == 200) {
        var jsonCovers = JSON.parse(body);
        death.area_covers = getGssCodes(jsonCovers);
      } else {
        console.log(">> Failed to fetch covered areas for '" + name + "'. Url: " + coversUrl + ". Response: " + body);
        death.area_covers = [];
      }

      // fetch 'areas this area overlaps'
      var overlapsUrl = "http://mapit.mysociety.org/area/"+death.area_id+"/overlaps?type=WMC"
      request(overlapsUrl, function(err, res, body) {
        if (err)
          throw err;
        if (res.statusCode == 200) {
          var jsonOverlaps = JSON.parse(body);
          death.area_overlaps = getGssCodes(jsonOverlaps);
        } else {
          console.log(">> Failed to fetch overlapped areas for '" + name + "'. Url: " + overlapsUrl + ". Response: " + body);
          death.area_overlaps = [];
        }

        enrichedCounter += 1;
        attemptToWriteData();
      });
    });
  });
});


