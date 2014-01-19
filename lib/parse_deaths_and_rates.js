#! /usr/bin/env node

var fs = require("fs"),
    xlsx = require("xlsx"),
    _ = require("underscore"),
    csv = require("csv");

var inputFile = "data/raw/deathsarea2011_tcm77-295437.xlsx",
    outputFileJson = "data/processed/deaths_and_rates.json",
    outputFileCsv  = "data/processed/deaths_and_rates.csv";

console.log("Parsing death data...");

rawData = xlsx.readFile(inputFile);
var sheet = rawData.Sheets["Table 1a"];

data = [];

var trim = function(s) { return s.replace(/^\s+|\s+$/g, ''); }
var val = function(row, col) {
  var v = sheet[col + row].v;
  if (v == ':' || v == '*' || v == '-')
    return 0;
  return v;
};
var cr = function(k) {
  var m = /^([A-Z]+)(\d+)$/.exec(k);
  var col = m[1], row = m[2];
  return { col: col, row: row };
}

var keys = _.keys(sheet);
var initialKeys = _.filter(keys, function(k) { return k[0] === 'A'; });
var areaRows = _.chain(initialKeys)
  .filter(function(k) {
    var row = cr(k).row;
    if (row < 13 || row > 529)
      return false;
    return true;
  })
  .map(function(k) { return cr(k).row; })
  .value();

_.each(areaRows, function(row) {
  data.push({
    area_name: trim(val(row, 'A')),
    population_total: Math.floor(val(row, 'B') * 1000),
    population_male: Math.floor(val(row, 'C') * 1000),
    population_female: Math.floor(val(row, 'D') * 1000),
    deaths_num_total: val(row, 'E'),
    deaths_num_male: val(row, 'F'),
    deaths_num_female: val(row, 'G'),
    deaths_num_infant: val(row, 'H'),
    deaths_num_neonatal: val(row, 'I'),
    deaths_num_perinatal: val(row, 'J'),
    deaths_rate_crude: val(row, 'K'),
    deaths_rate_agestd_total: val(row, 'L'),
    deaths_rate_agestd_male: val(row, 'M'),
    deaths_rate_agestd_female: val(row, 'N'),
    deaths_rate_infant: val(row, 'O'),
    deaths_rate_neonatal: val(row, 'P'),
    deaths_rate_perinatal: val(row, 'Q'),
  });
});


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

console.log("Data found for " + data.length + " areas");
