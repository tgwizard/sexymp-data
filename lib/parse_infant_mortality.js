#! /usr/bin/env node

var fs = require('fs');
var parse = require('csv-parse');
var csv = require('csv');
var _ = require('underscore');

var inputFile1 = "data/infant_mortality/raw/a09_VS1_Non_NHS_Version.csv";
var outputFile1 = "data/infant_mortality/processed/a09";
var inputFile2 = "data/infant_mortality/raw/a08_VS1_Non_NHS_Version 2.csv";
var outputFile2 = "data/infant_mortality/processed/a08";

parseWeirdCsv(inputFile1, outputFile1, 5, 28, 39, ['Hackney and City of London']);
parseWeirdCsv(inputFile2, outputFile2, 5, 32, 43, ['Hackney and City of London', 'Penwith and Isles of Scilly']);

function parseWeirdCsv(inputFile, outputFile, startRow, diffToData, entityRowDiff, incOneList) {
  var rawText = fs.readFileSync(inputFile, 'utf8');
  parse(rawText, function(err, rawData) {
    var data = [];
    for (var i = startRow; i < rawData.length; i += entityRowDiff) {
      var name = trim(rawData[i][1]);

      //console.log(name);

      var im1ym = trim(rawData[i+diffToData+0][3]);
      var im4wm = trim(rawData[i+diffToData+1][3]);
      var impm  = trim(rawData[i+diffToData+2][3]);
      var im1yf = trim(rawData[i+diffToData+0][4]);
      var im4wf = trim(rawData[i+diffToData+1][4]);
      var impf  = trim(rawData[i+diffToData+2][4]);
      var im1yp = trim(rawData[i+diffToData+0][5]);
      var im4wp = trim(rawData[i+diffToData+1][5]);
      var impp  = trim(rawData[i+diffToData+2][5]);

      data.push({
        name: name,
        im_males_under_1y: fixNumber(im1ym),
        im_males_under_4w: fixNumber(im4wm),
        im_males_perinatal: fixNumber(impm),
        im_females_under_1y: fixNumber(im1yf),
        im_females_under_4w: fixNumber(im4wf),
        im_females_perinatal: fixNumber(impf),
        im_persons_under_1y: fixNumber(im1yp),
        im_persons_under_4w: fixNumber(im4wp),
        im_persons_perinatal: fixNumber(impp),
      });

      // There is an extra line for some areas "#  Rates are for Hackney only."
      if (incOneList.indexOf(name) != -1) i += 1;
    }

    writeData(rawData, outputFile + '-temp');
    writeData(data, outputFile, _.keys(data[0]));
  });
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
  return s.replace(/^\s+/, '').replace(/\s+$/, '');
}

function fixNumber(s) {
  return parseFloat(s.replace(/\*/, ''));
}
