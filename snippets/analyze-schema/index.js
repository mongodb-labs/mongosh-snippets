(() => {
  const localRequire = require('module').createRequire(__filename);
  const schema = localRequire('mongodb-schema');
  const { Readable, PassThrough } = localRequire('stream');
  const { Console } = localRequire('console');

  globalThis.schema = function(collOrCursor, options = {}) {
    let cursor;
    if (typeof collOrCursor.tryNext === 'function') {
      cursor = collOrCursor;
    } else {
      const size = Math.min(Math.max(20, collOrCursor.estimatedDocumentCount() * 0.04), 10000);
      cursor = collOrCursor.aggregate([{$sample: { size: Math.ceil(size) }}]);
    }

    const schemaStream = schema.stream({ semanticTypes: true, ...options });
    let result;
    schemaStream.on('data', (data) => result = data);

    let doc;
    while ((doc = cursor.tryNext()) !== null) {
      schemaStream.write(doc);
    }
    schemaStream.end();
    sleep(0);

    if (options.verbose) {
      return result;
    }

    const simplified = [];
    let maxFieldPathLength = 0;
    for (const field of allFields(result.fields)) {
      maxFieldPathLength = Math.max(maxFieldPathLength, field.path.length);
      const types = field.types || [{ name: field.type, probability: 1 }];
      for (const { probability, name } of types) {
        simplified.push([field.path, `${(probability * 100).toFixed(1)} %`, name]);
      }
    }

    for (const entry of simplified) {
      entry[0] = entry[0].padEnd(maxFieldPathLength);
    }

    return tablify(simplified);
  };

  function tablify(input) {
    const io = new PassThrough({ encoding: 'utf8' });
    new Console(io).table(input);
    return io.read();
  }

  function* allFields(fieldArray) {
    for (const field of fieldArray) {
      yield field;
      for (const type of field.types || []) {
        if (type.fields) {
          yield* allFields(type.fields);
        }
      }
    }
  }
})();
