(() => {
  const localRequire = require('module').createRequire(__filename);
  const decodeImpl = localRequire('mongodb-resumetoken-decoder').decodeResumeToken;

  globalThis.decodeResumeToken = function(token) {
    if (typeof token === 'string') {
      return decodeImpl(token);
    }
    if (token && typeof token._data === 'string') {
      return decodeImpl(token._data);
    }
    if (token && token._id && typeof token._id._data === 'string') {
      return decodeImpl(token._id._data);
    }
    throw new Error(`Unknown token format, expected string: ${token}`);
  }
})();

