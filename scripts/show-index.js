'use strict';
const { promises: fs } = require('fs');
const path = require('path');
const bson = require('bson');
const zlib = require('zlib');
const util = require('util');

(async() => {
  const source = await fs.readFile(path.join(__dirname, '..', 'index.bson.br'));
  console.dir(bson.deserialize(await util.promisify(zlib.brotliDecompress)(source)).index, { depth: Infinity });
})().catch(err => { process.nextTick(() => { throw err; }); });
