const fs = require('fs');
const request = require("request");
const cheerio = require("cheerio");
const elasticsearch = require('elasticsearch');
const naics_pscs = require('./naics_pscs_json');
const naicsCodes = require('./naicsCodes');
const baseURL = `https://www.naics.com/naics-code-description/?code=`;

const naicsDataUrl = code => baseURL + code;
let itemsTotal = 0;
let itemsWritten = 0;

const ELASTIC_HOST = 'https://elastic';
const ELASTIC_PORT = 'DFes4aVktQsdSpAZqmogbQwM@2553f28c6c6e48309e28c343172b3c26.us-east-1.aws.found.io:9243';

/* Constants */
const client = new elasticsearch.Client({host: ELASTIC_HOST + ":" + ELASTIC_PORT});

const elasticCheck = () => {
    console.log('Checking Elasticsearch.');
    client.ping({
        requestTimeout: 30000,
    }, function (error) {
        if (error) {
            console.error('Elasticsearch IS DOWN!');
        } else {
            console.log('Checking Elasticsearch Is OK!.');
        }
    });
}

function getNaics(codes) {
    fs.appendFile('json.json', '[\n', () => {});
    itemsTotal = codes.length;
    if (codes.forEach) {
        codes.forEach(naics)
    } else {
        naics(codes);
    }
}

function naics(code) {
    if (code) {
        request.get(naicsDataUrl(code),
            (error, response, data) => {
                const $ = cheerio.load(data);

                let desc = $('.entry-content h4.sixDigit').html();
                if (desc) desc = desc.replace(/^<strong>\d+<\/strong> - /, '').trim();

                let descExtended = $('.entry-content h4.sixDigit + p').html();
                if (descExtended) descExtended.trim();
                let crossRef = $('.entry-content .crossreference').html();
                if (crossRef && descExtended) {
                    descExtended += `<ul>${crossRef.trim()}</ul>`;
                }

                const pscs = naics_pscs[code] ? naics_pscs[code].join(',') : '';

                const line = `{"index":{"_id":"${code}"}}`;
                const naics = JSON.stringify({NAICS: `${code}`, desc, descExtended, pscs}).replace(/\\n/g, '');

                const write = `${line}
${naics}\n`;
                const write2 = `${naics}${(itemsWritten < itemsTotal - 1) ? ',\n' : '\n]\n'}`;

                fs.appendFile('naics.json', write, function (err) {
                    if (err) throw err;
                });

                fs.appendFile('json.json', write2, function (err) {
                    if (err) throw err;
                    itemsWritten++;
                });
            });
    }
}

function chunk(array, size) {
    const chunked_arr = [];
    let copied = [...array]; // ES6 destructuring
    const numOfChild = Math.ceil(copied.length / size); // Round up to the nearest integer
    for (let i = 0; i < numOfChild; i++) {
        chunked_arr.push(copied.splice(0, size));
    }
    return chunked_arr;
}

elasticCheck();
const arr = chunk(naicsCodes, 100);
console.log(arr.length)
// const items = [...arr[0],...arr[1],...arr[2], ...arr[3]];
// getNaics(items);