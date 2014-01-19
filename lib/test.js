#! /usr/bin/env node

var fs = require("fs"),
    _ = require("underscore"),
    request = require("request");

var url = "http://mapit.mysociety.org/areas/CTY,DIS,UTA";
request(url, function(err, response, body) {
  var areas = JSON.parse(body);
  console.log("MAPIT: ", _.keys(areas).length);
  console.log("D&R: ", JSON.parse(fs.readFileSync("data/processed/deaths_and_rates.json")).length);
  console.log("MPs: ", JSON.parse(fs.readFileSync("data/processed/sexymp.json")).length);
});


