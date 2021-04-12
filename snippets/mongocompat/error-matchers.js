module.exports = [
  {
    matches: [
      /\b(tojson|tojsononeline|tojsonObject|printjsononeline|isString|isNumber|isObject) is not defined/,
      /\.tojson is not a function/,
      /(\.getTime|\.getInc|\.toStringIncomparable) is not a function/,
      /(\.ltrim|\.rtrim|\.pad) is not a function/,
      /(\.toPercentStr|\.zeroPad) is not a function/,
      /\bDate\.timeFunc is not a function/,
      /\bRegExp\.escape is not a function/,
      /\bArray\.(contains|unique|shuffle|fetchRefs|sum|avg|stdDev) is not a function/,
      /\bObject\.(extend|bsonsize|merge|keySet) is not a function/,
      /\bObjectId\.fromDate is not a function/,
    ],
    message: 'Are you trying to run a script written for the legacy shell? Try running `snippet install mongocompat`'
  }
];
