#! /usr/bin/env node

var fs = require("fs"),
    xlsx = require("xlsx"),
    _ = require("underscore"),
    csv = require("csv");

var inputFile = "data/raw/referencetabletables512_tcm77-332896.xlsx",
    outputFileJson = "data/processed/life_expectancy.json",
    outputFileCsv  = "data/processed/life_expectancy.csv";

console.log("Parsing life expectancy data...");

rawData = xlsx.readFile(inputFile);
var sheet = null;

data = {};

var trim = function(s) { return s.replace(/^\s+|\s+$/g, ''); }
var val = function(row, col) { return (sheet[col + row] === undefined) ? null : sheet[col + row].v };
var cr = function(k) {
  var m = /^([A-Z]+)(\d+)$/.exec(k);
  if (!m)
    return null;
  return { col: m[1], row: m[2] };
}

var getAreaRows = function() {
  var keys = _.keys(sheet);
  var areaRows = _.chain(keys)
    .map(function(k) { return cr(k); })
    .filter(function(cr) {
      if (!cr)
        return false;
      if (cr.col != 'A')
        return false;
      if (cr.row < 5 || cr.row > 455)
        return false;
      return true;
    })
    .map(function(cr) { return cr.row; })
    .value();
  return areaRows;
};

var sheets = [
  { sheet: "Table 7",  prefix: "life_exp_birth_male" },
  { sheet: "Table 8",  prefix: "life_exp_birth_female" },
  { sheet: "Table 11", prefix: "life_exp_65_male" },
  { sheet: "Table 12", prefix: "life_exp_65_female" },
];

_.each(sheets, function(sh) {
  sheet = rawData.Sheets[sh.sheet];
  var sheetData = [];
  _.each(getAreaRows(), function(row) {
    var code = val(row, 'A');
    if (!code)
      return;
    code = trim(code);

    var name_big = val(row, 'C');
    var name_small = val(row, 'D');
    var area_name = name_small || name_big;
    if (!area_name)
      return;
    area_name = trim(area_name);

    var years = val(row, 'AI');
    var rank = val(row, 'AJ');
    if (years === null || rank === null)
      return;

    var newData = {};
    newData["area_name"] = area_name;
    newData["code"] = code;
    newData[sh.prefix + "_" + "years"] = years;
    newData[sh.prefix + "_" + "rank"] = rank;
    sheetData.push(newData);
  });
  data[sh.prefix] = sheetData;
});

var prevLen = null;
_.each(_.keys(data), function(dk) {
  var len = data[dk].length;
  console.log("Dataset", "'"+dk+"'", "contains", len, "items");
  if (prevLen === null)
    prevLen = len;
  else
    if (prevLen !== len)
      throw new "Lenghts for data sets differ!";
});

// Merge data
var mergedDataRaw = {};
_.each(_.keys(data), function(dk) {
  _.each(data[dk], function(d) {
    var obj = mergedDataRaw[d.area_name] || { };
    _.each(_.keys(d), function(k) {
      obj[k] = d[k];
    });
    mergedDataRaw[d.area_name] = obj;
  });
});

var mergedDataList = _.map(_.keys(mergedDataRaw), function(name) {
  return mergedDataRaw[name];
});

if (mergedDataList.length !== prevLen)
  throw new "Merged data list contained incorrectly " + mergedDataList + " elements";

var jsonString = JSON.stringify(mergedDataList, null, 2);
//console.log(jsonString);
fs.writeFileSync(outputFileJson, jsonString);
csv().from(mergedDataList).to.options({
  quoted: true,
  delimiter: ',',
  columns: _.keys(mergedDataList[0]),
  header: true
}).to.string(function(csvString) {
  csvString = "sep=,\n" + csvString;
  fs.writeFileSync(outputFileCsv, csvString);
});

console.log("Data for " + mergedDataList.length + " areas found");
