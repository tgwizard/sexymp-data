#! /usr/bin/env node

var fs = require("fs"),
    _ = require("underscore"),
    cheerio = require("cheerio"),
    csv = require("csv");

var inputFileAll = "data/raw/sexymp.co.uk.html",
    inputFileM = "data/raw/sexymp_male.co.uk.html",
    inputFileF = "data/raw/sexymp_female.co.uk.html",
    outputFileJson = "data/processed/sexymp.json",
    outputFileCsv  = "data/processed/sexymp.csv";

data = [];

console.log("Parsing data from sexymp.co.uk HTML...");

var $ = cheerio.load(fs.readFileSync(inputFileAll));
var $male = cheerio.load(fs.readFileSync(inputFileM));
var $female = cheerio.load(fs.readFileSync(inputFileF));

var getGenderSign = function(img_src) {
  var m = $male("img[src='"+img_src+"']").length != 0;
  var f = $female("img[src='"+img_src+"']").length != 0;
  if (m && f) return "!";
  if (m) return "M";
  if (f) return "F";
  return "?";
};

var clean_ch = function(str) {
  return str.replace(/[^\w\s#:,()-]/gi, '!');
};

$("table[width='700px']").find("tr").each(function(index, element) {
  // Every other row is just an &nbsp; <td>
  if ($(this).children().length == 1)
    return;
  // Each item consists of two <td>s, first an image, then the info
  var image_tds = $(this).children().filter(function(i) { return i % 2 == 0; });
  image_tds.each(function(index, element) {
    var name = $(this).find("img").attr("title");
    var image_src = $(this).find("img").attr("src");
    name = name.replace(/^\s+|\s+$/g, '');
    name = clean_ch(name);
    var obj = {
      name: name
    };

    var data_td = $(this).next();
    var text = data_td.text();
    text = text.replace(/\s+/g, ' ');
    text = clean_ch(text);
    //console.log(text);

    var parties = "Conservative|Labour Co-operative|Labour|Liberal Democrat|Scottish National Party|Democratic Unionist|Plaid Cymru|Social Democratic and Labour|Sinn Fein|Alliance|Green Party|Independent|Bi-Curious"
    var regexp = new RegExp("^#(\\d+) "+name+" ("+parties+") (.*) Score: (\\d+) Won: (\\d+) Lost: (\\d+)$");
    var match = regexp.exec(text);
    if (match != null) {
      obj.ranking = match[1];
      obj.constituency = match[3];
      obj.party = match[2];
      obj.score = match[4];
      obj.won = match[5];
      obj.lost = match[6];
      obj.image = "http://sexymp.co.uk/" + image_src;
      obj.gender = getGenderSign(image_src);
      data.push(obj);
    } else {
      console.error("Could not parse for " + name + ": \""+text+"\”");
    }
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

console.log("Data for " + data.length + " MPs found");
