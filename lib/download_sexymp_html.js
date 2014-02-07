#! /usr/bin/env node

var fs = require("fs"),
    request = require("request");

var urlAll = "http://sexymp.co.uk/";
var urlM = "http://sexymp.co.uk/index.php?gender=M";
var urlF = "http://sexymp.co.uk/index.php?gender=F";
var outputFileAll = "data/raw/sexymp.co.uk.html";
var outputFileM = "data/raw/sexymp_male.co.uk.html";
var outputFileF = "data/raw/sexymp_female.co.uk.html";

console.log("All MPS: %s => %s", urlAll, outputFileAll);
console.log("Male MPS: %s => %s", urlM, outputFileM);
console.log("Female MPS: %s => %s", urlF, outputFileF);

request(urlAll).pipe(fs.createWriteStream(outputFileAll));
request(urlM).pipe(fs.createWriteStream(outputFileM));
request(urlF).pipe(fs.createWriteStream(outputFileF));
