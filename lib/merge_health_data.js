#! /usr/bin/env node

var fs = require("fs"),
    _ = require("underscore"),
    csv = require("csv");

var readJson = function(filename) {
  return JSON.parse(fs.readFileSync(filename));
};

var lifeData = readJson("data/processed/life_expectancy.json");
var deathData = readJson("data/processed/deaths_and_rates.json");

var outputFileJson = "data/processed/health.json";
var outputFileCsv = "data/processed/health.csv";

console.log(lifeData.length, deathData.length);

var lifeMap = {};
var deathMap = {};

_.each(lifeData, function(d) {
  lifeMap[d.area_name] = d;
});
_.each(deathData, function(d) {
  deathMap[d.area_name] = d;
});


var merge = function(a, b) {
  var d = _.clone(b);
  _.each(_.keys(a), function(k) {
    d[k] = a[k];
  });
  return d;
};

var mergedData = [];

_.each(lifeData, function(d) {
  if (deathMap[d.area_name] === undefined) {
    console.log("Cannot find death data matching life data with area:", d.area_name);
    d.contains_life_data = true;
    d.contains_death_data = false;
    mergedData.push(d);
  } else {
    var dd = merge(d, deathMap[d.area_name]);
    dd.contains_life_data = true;
    dd.contains_death_data = true;
    mergedData.push(dd);
  }
});
_.each(deathData, function(d) {
  if (lifeMap[d.area_name] === undefined) {
    console.log("Cannot find life data matching death data with area:", d.area_name);
    d.contains_life_data = false;
    d.contains_death_data = true;
    mergedData.push(d);
  }
});

var jsonString = JSON.stringify(mergedData, null, 2);

var keys = _.unique(["area_name", "code"].concat(_.keys(lifeData[0])).concat(_.keys(deathData[0])).concat(["contains_life_data", "contains_death_data"]));
fs.writeFileSync(outputFileJson, jsonString);
csv().from(mergedData).to.options({
  quoted: true,
  delimiter: ',',
  columns: keys,
  header: true
}).to.string(function(csvString) {
  csvString = "sep=,\n" + csvString;
  fs.writeFileSync(outputFileCsv, csvString);
});
