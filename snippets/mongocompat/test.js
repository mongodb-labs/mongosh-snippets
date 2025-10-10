load(__dirname + '/index.js');

assert.strictEqual(ObjectId('0123456789abcdef01234567').tojson(), 'ObjectId("0123456789abcdef01234567")');

assert.strictEqual(BinData(4, 'abcdefgh').toString(), 'BinData(4,"abcdefgh")');

assert.strictEqual(NumberLong(1234567890).toString(), 'NumberLong(1234567890)');
const nl1 = NumberLong(9.223372036854776e+18, 2147483647, 4294967295);
assert.strictEqual(nl1.floatApprox, 9223372036854776000);
assert.strictEqual(nl1.top, 2147483647);
assert.strictEqual(nl1.bottom, 4294967295);
assert.strictEqual(nl1.exactValueString(), "9223372036854775807");
const nl2 = NumberLong("200");
assert.strictEqual(nl1.compare(nl2), 1);
