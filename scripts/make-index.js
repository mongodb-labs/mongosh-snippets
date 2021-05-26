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
    try {
      pjson.readme = await fs.readFile(path.join(snippetsDir, dir.name, 'README.md'), 'utf8');
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    index.push(pjson);
  }

  const ownPjsonPath = path.join(__dirname, '..', 'package.json');
  const ownPjson = JSON.parse(await fs.readFile(ownPjsonPath, 'utf8'));
  const metadata = (({ homepage, repository, bugs }) => ({ homepage, repository, bugs }))(ownPjson);
  const indexFileContents = {
    indexFileVersion: 1,
    index,
    metadata
  };

  const data = await util.promisify(zlib.brotliCompress)(bson.serialize(indexFileContents), {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY
    }
  });
  await fs.writeFile(path.join(__dirname, '..', 'index.bson.br'), data);
})().catch(err => { process.nextTick(() => { throw err; }); });
