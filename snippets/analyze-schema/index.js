(() => {
  const localRequire = require('module').createRequire(__filename);
  const schema = localRequire('@mongodb-js/mongodb-schema');
  const { Readable, PassThrough } = localRequire('stream');
  const { Console } = localRequire('console');

  globalThis.schema = async function(collOrCursor, options = {}) {
    let cursor;
    if (typeof collOrCursor.tryNext === 'function') {
      cursor = collOrCursor;
    } else {
      const size = Math.min(Math.max(20, collOrCursor.estimatedDocumentCount() * 0.04), 10000);
      cursor = collOrCursor.aggregate([{$sample: { size: Math.ceil(size) }}]);
    }

    const docs = [];
    let doc;
    while ((doc = cursor.tryNext()) !== null) {
      docs.push(doc);
    }

    const result = await schema.parseSchema(docs, { semanticTypes: true, ...options });

    if (options.verbose) {
      return result;
    }

    const simplified = [];
    let maxFieldPathLength = 0;
    for (const field of allFields(result.fields)) {
      // As of @mongodb-js/mongodb-schema v10, `path` is an array of path components.
      const path = Array.isArray(field.path) ? field.path.join('.') : field.path;
      maxFieldPathLength = Math.max(maxFieldPathLength, path.length);
      const types = field.types || [{ name: field.type, probability: 1 }];
      for (const { probability, name } of types) {
        simplified.push([path, `${(probability * 100).toFixed(1)} %`, name]);
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
