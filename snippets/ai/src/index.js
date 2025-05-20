// tsc generates a module.exports for TypeScript files so we have this wrapper to load the module
(() => {
    const localRequire = require('module').createRequire(__filename);
    // eslint-disable-next-line no-undef
    localRequire('./ai.js')(globalThis);
})();