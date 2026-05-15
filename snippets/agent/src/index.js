'use strict';
// Wrapper to create a proper require context for mongosh snippet loading
(() => {
  const localRequire = require('module').createRequire(__filename);
  // eslint-disable-next-line no-undef
  localRequire('./agent.js')(globalThis);
})();
