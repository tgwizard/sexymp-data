#! /usr/bin/env node

var fs = require('fs');
var parse = require('csv-parse');
var csv = require('csv');
var xlsx = require("xlsx");
var _ = require('underscore');

var inputFile1 = "data/infant_mortality/raw/a09_VS1_Non_NHS_Version.csv";
var outputFile1 = "data/infant_mortality/processed/a09";
var inputFile2 = "data/infant_mortality/raw/a08_VS1_Non_NHS_Version 2.csv";
var outputFile2 = "data/infant_mortality/processed/a08";

var inputFile3 = "data/infant_mortality/raw/Infant mortality statistics E&W 2006 and 2007.xlsx"
var outputFile306 = "data/infant_mortality/processed/a06";
var outputFile307 = "data/infant_mortality/processed/a07";

var finalOutputFile = "data/infant_mortality/processed/all";

var mergedCount = 0;
var preMerge = {};

parseWeirdCsv(inputFile1, outputFile1, 5, 28, 39, ['Hackney and City of London'], mergeData);
parseWeirdCsv(inputFile2, outputFile2, 5, 32, 43, ['Hackney and City of London', 'Penwith and Isles of Scilly'], mergeData);

parseXls(inputFile3, outputFile306, '2006', 11, 624, mergeData);
parseXls(inputFile3, outputFile307, '2007', 11, 624, mergeData);



function mergeData(filename, data) {
  var parts = filename.split('/');
  var prefix = parts[parts.length-1].replace(/a/, '');

  _.each(data, function(d) {
    // Here we merge data for areas that probably refer to the same area
    var name = trim(d.name.replace(/ CD| LB| MD| UA|3|4|5| County| GOR|, of/g, ''));
    if (name.indexOf('King') == 0) {
      // Fix bad encoding
      name = name.replace(/King.s /, 'King\'s ');
    }
    if (!preMerge[name]) preMerge[name] = {};
    preMerge[name][prefix + '_infant_mortality'] = d.infant_mortality;
    //console.log(preMerge[d.name]);
  });
  mergedCount += 1;

  if (mergedCount == 4) {
    var keys = _.sortBy(_.keys(preMerge), function(k) { return k.toLowerCase() });

    var mergedData = _.map(keys, function(k) { return _.extend({name: k}, preMerge[k]); });
    //console.log(mergedData);

    writeData(mergedData, finalOutputFile, ['name','06_infant_mortality','07_infant_mortality','08_infant_mortality','09_infant_mortality']);
  }
}

function parseWeirdCsv(inputFile, outputFile, startRow, diffToData, entityRowDiff, incOneList, done) {
  function fixNumber(s) {
    return parseFloat(s.replace(/\*/, ''));
  }

  var rawText = fs.readFileSync(inputFile, 'utf8');
  parse(rawText, function(err, rawData) {
    var data = [];
    for (var i = startRow; i < rawData.length; i += entityRowDiff) {
      var name = trim(rawData[i][1]);

      //console.log(name);

      var im = trim(rawData[i+diffToData+0][3]);

      data.push({
        name: name,
        infant_mortality: fixNumber(im),
      });

      // There is an extra line for some areas "#  Rates are for Hackney only."
      if (incOneList.indexOf(name) != -1) i += 1;
    }

    writeData(rawData, outputFile + '-temp');
    writeData(data, outputFile, _.keys(data[0]));
    done(outputFile, data);
  });
}

function parseXls(inputFile, outputFile, worksheet, startRow, endRow, done) {
  rawData = xlsx.readFile(inputFile);
  var sheet = rawData.Sheets[worksheet];

  data = [];

  var val = function(row, col) {
    var v = sheet[col + row].v;
    if (v == ':' || v == '*' || v == '-' || v == ' -' || v == '  -')
      return 0;
    return v;
  };
  var cr = function(k) {
    var m = /^([A-Z]+)(\d+)$/.exec(k);
    var col = m[1], row = m[2];
    return { col: col, row: row };
  };

  var keys = _.keys(sheet);
  var initialKeys = _.filter(keys, function(k) { return k[0] === 'A'; });
  var areaRows = _.chain(initialKeys)
    .filter(function(k) {
      var row = cr(k).row;
      if (row < startRow || row > endRow)
        return false;
      return true;
    })
    .map(function(k) { return cr(k).row; })
    .value();

  _.each(areaRows, function(row) {
    var name = trim(val(row, 'A'));
    if (!name) return;
    if (name == 'Normal residence outside') return;

    //console.log(name);

    var im = val(row, 'K');

    data.push({
      name: name,
      infant_mortality: im,
    });
  });

  writeData(data, outputFile, _.keys(data[0]));
  done(outputFile, data);
}

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

function trim(s) {
  return s ? s.replace(/^\s+|\s+$/g, '') : '';
}
