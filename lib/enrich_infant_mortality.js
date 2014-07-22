#! /usr/bin/env node

var fs = require("fs"),
    xlsx = require("xlsx"),
    _ = require("underscore"),
    csv = require("csv"),
    request = require("request");

var inputFile  = "data/infant_mortality/processed/all.json",
    outputFile = "data/infant_mortality/processed/all_enriched";

console.log("Enriching data for infant mortality area with area info from mapit.mysociety.org...");

var data = JSON.parse(fs.readFileSync(inputFile));

var REQUEST_TIMEOUT = 2000; // We are only allowed an average of 1 req/s ("rolling over 3 minutes")

var areasToSkip = [
  'Bedfordshire', // ceremonial
  'Cheshire', // ceremonial
  'City of London',
  'Cornwall and Isles of Scilly',
  'EAST',
  'EAST MIDLANDS',
  'Eilean Siar',
  'ENGLAND',
  'ENGLAND AND WALES',
  'England and Wales',
  'England, Wales and Elsewhere',
  'ENGLAND, WALES AND ELSEWHERE',
  'Greater Manchester (Met)',
  'Inner London',
  'London',
  'LONDON',
  'Merseyside (Met)',
  'NORTH EAST',
  'NORTH WEST',
  'NORTHERN IRELAND',
  'Outer London',
  'Outside England and Wales',
  'Penwith',
  'SCOTLAND',
  'SOUTH EAST',
  'SOUTH WEST',
  'South Yorkshire (Met)',
  'Tyne and Wear (Met)',
  'UNITED KINGDOM',
  'WALES',
  'WEST MIDLANDS',
  'West Midlands (Met)',
  'West Yorkshire (Met)',
  'YORKSHIRE AND THE HUMBER',
];

var badOnsAreas = [
  'Bedford',
  'Buckinghamshire',
  'Cambridgeshire',
  'Cumbria',
  'Derbyshire',
  'Devon',
  'Dorset',
  'East Sussex',
  'Essex',
  'Gloucestershire',
  'Hampshire',
  'Hertfordshire',
  'Kent',
  'Lancashire',
  'Leicestershire',
  'Lincolnshire',
  'Norfolk',
  'North Yorkshire',
  'Northamptonshire',
  'Northumberland',
  'Nottinghamshire',
  'Oxfordshire',
  'Shropshire',
  'Somerset',
  'Staffordshire',
  'Suffolk',
  'Surrey',
  'Warwickshire',
  'West Sussex',
  'Wiltshire',
  'Worcestershire',
];

data = _.filter(data, function(d) { return areasToSkip.indexOf(d.name) == -1; });
//data = _.rest(data, 445);
var enrichedCounter = 0;


_.each(data, function(d, i) {
  var name = d.name.replace('&', 'and');
  if (name == "Belfast") name = "Belfast City Council"; // Only called Belfast in ONS
  if (name == "Cambridgeshire") name = "Cambridgeshire County Council";
  if (name == "Derbyshire") name = "Derbyshire County Council";
  if (name == "Edinburgh, City of") name = "City of Edinburgh";
  if (name == "Fermanagh") name = "Fermanagh District Council";
  if (name == "Hackney") name = "Hackney Borough Council";
  if (name == "North Ayrshire") name = "North Ayrshire Council";
  if (name == "Staffordshire") name = "Staffordshire County Council";
  if (name == "Suffolk") name = "Suffolk County Council";
  if (name == "Surrey") name = "Surrey County Council";

  var expectSingleAreaResult = false;
  var url = "http://mapit.mysociety.org/areas/"+name+"?type=WMC,UTA,LGD,CTY,LBO,COI";
  if (d.ons && badOnsAreas.indexOf(d.name) == -1) { 
    expectSingleAreaResult = true;
    url = "http://mapit.mysociety.org/area/"+d.ons.substr(1);
  }

  setTimeout(function() {
    request(url, function(err, res, body) {
      if (err)
        throw err;
      console.log(url);
      var jsonData = JSON.parse(body);
      if (!jsonData) {
        console.log(res);
        throw new Error("Couldn't parse body to JSON");
      }

      if (jsonData.error) { 
        console.log("error in response for area " + d.name + ", ons: " + d.ons + ": " + ks);
        throw new Error(body);
      }

      var a = null;
      if (expectSingleAreaResult) {
        a = jsonData;
      } else {
        var ks = _.keys(jsonData);
        if (ks.length == 0)
          throw ("No responses for area " + d.name + ", ons: " + d.ons + ": " + url);
        if (ks.length == 1)
          a = jsonData[ks[0]];
        if (ks.length != 1) {
          _.each(ks, function(aks) {
            if (a && a.type == 'WMC') return;

            if (a && a.type == 'UTA' && aks.type != '"WMC"') return;
            if (jsonData[aks].name == name) a = jsonData[aks];
          });
          if (a == null) {
            console.log(jsonData);
            throw ("Unexpected number of responses for area " + d.name + ", ons: " + d.ons + ": " + ks);
          }
        }
      }

      d.area_gss_code = a.codes.gss;
      d.area_id = a.id;
      d.area_mapit_name = a.name;
      d.country = a.country_name;
      enrichedCounter += 1;

      if (enrichedCounter == data.length) {
        // Write to files
        writeData(data, outputFile, _.keys(data[0]));
      }
    });
  }, REQUEST_TIMEOUT*i);
});

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
