#! /usr/bin/env node

var fs = require("fs"),
    request = require("request");

var url = "http://sexymp.co.uk/";
var outputFile = "data/raw/sexymp.co.uk.html";
request(url).pipe(fs.createWriteStream(outputFile));
