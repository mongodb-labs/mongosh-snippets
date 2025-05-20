// tsc assigns to a global exports variable for TypeScript files which doesn't pair well
// with mongosh scripts so we have this wrapper to load the module and minimize rewriting.
(() => {
    const localRequire = require('module').createRequire(__filename);
    // eslint-disable-next-line no-undef
    localRequire('./ai.js')(globalThis);
})();