'use strict';
const { promises: fs } = require('fs');
const path = require('path');
const bson = require('bson');
const zlib = require('zlib');
const util = require('util');

(async() => {
  const snippetsDir = path.join(__dirname, '..', 'snippets');
  const index = [];
  for await (const dir of await fs.opendir(snippetsDir)) {
    if (!dir.isDirectory()) continue;
    const pjsonPath = path.join(snippetsDir, dir.name, 'package.json');
    const pjson = JSON.parse(await fs.readFile(pjsonPath, 'utf8'));
    if (pjson.errorMatchers) {
      pjson.errorMatchers = require(path.join(snippetsDir, dir.name, pjson.errorMatchers));
    }
    index.push(pjson);
  }
  const data = await util.promisify(zlib.brotliCompress)(bson.serialize({ index }), {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY
    }
  });
  await fs.writeFile(path.join(__dirname, '..', 'index.bson.br'), data);
})().catch(err => { process.nextTick(() => { throw err; }); });
