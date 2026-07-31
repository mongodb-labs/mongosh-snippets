'use strict';
const assert = require('assert');
const { test } = require('node:test');

require('./index.js');

function makeCursor(docs) {
  let i = 0;
  return { tryNext: () => (i < docs.length ? docs[i++] : null) };
}

function makeCollection(docs, { count = docs.length } = {}) {
  return {
    estimatedDocumentCount: () => count,
    aggregate: (pipeline) => {
      assert.deepStrictEqual(Object.keys(pipeline[0]), ['$sample']);
      return makeCursor(docs.slice(0, pipeline[0].$sample.size));
    }
  };
}

test('defines a global schema() helper', () => {
  assert.strictEqual(typeof globalThis.schema, 'function');
});

test('tablifies field paths, probabilities and types from a cursor', async () => {
  const out = await schema(makeCursor([{ a: 1 }, { a: 'str' }]));
  assert.match(out, /\ba\b/);
  assert.match(out, /Number/);
  assert.match(out, /String/);
  assert.match(out, /50\.0 %/);
});

test('reports 100 % for a field present in every document', async () => {
  const out = await schema(makeCursor([{ a: 1 }, { a: 2 }]));
  assert.match(out, /100\.0 %/);
  assert.doesNotMatch(out, /undefined/);
});

test('flattens nested document fields into dotted paths', async () => {
  const out = await schema(makeCursor([{ b: { c: 'x' } }, { b: { c: 2 } }]));
  assert.match(out, /b\.c/);
});

test('reports array fields as Array without descending into their elements', async () => {
  const out = await schema(makeCursor([{ items: [{ sku: 'a' }, { sku: 'b' }] }]));
  assert.match(out, /\bitems\b/);
  assert.match(out, /Array/);
  assert.doesNotMatch(out, /items\.sku/);
});

test('samples a collection when given something that is not a cursor', async () => {
  const docs = Array.from({ length: 100 }, (_, i) => ({ n: i }));
  const out = await schema(makeCollection(docs));
  assert.match(out, /\bn\b/);
  assert.match(out, /Number/);
});

test('verbose: true returns the raw schema object', async () => {
  const result = await schema(makeCursor([{ a: 1 }]), { verbose: true });
  assert.strictEqual(result.count, 1);
  assert.strictEqual(result.fields[0].name, 'a');
  // v12 exposes `path` as an array of path components.
  assert.deepStrictEqual(result.fields[0].path, ['a']);
});

test('detects semantic types by default', async () => {
  const docs = Array.from({ length: 10 }, () => ({ email: 'someone@example.com' }));
  const result = await schema(makeCursor(docs), { verbose: true });
  assert.deepStrictEqual(
    result.fields[0].types.map((t) => t.name),
    ['Email']
  );
});

test('handles an empty result set', async () => {
  const result = await schema(makeCursor([]), { verbose: true });
  assert.strictEqual(result.count, 0);
  assert.deepStrictEqual(result.fields, []);
});
