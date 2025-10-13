load(__dirname + '/index.js');

assert.strictEqual(ObjectId('0123456789abcdef01234567').tojson(), 'ObjectId("0123456789abcdef01234567")');

assert.strictEqual(BinData(4, 'abcdefgh').toString(), 'BinData(4,"abcdefgh")');

assert.strictEqual(NumberLong(2147483647).toString(), 'NumberLong(2147483647)');
assert.strictEqual(NumberLong("2147483648").toString(), 'NumberLong("2147483648")');
assert.strictEqual(NumberLong(-2147483648).toString(), 'NumberLong(-2147483648)');
assert.strictEqual(NumberLong(-2147483649).toString(), 'NumberLong("-2147483649")');
assert.strictEqual(NumberLong(9223372036854775807).toString(), 'NumberLong("9223372036854775807")');
assert.strictEqual(NumberLong(-9223372036854775808).toString(), 'NumberLong("-9223372036854775808")');
const maxLong = NumberLong(9223372036854775807, 2147483647, -1);
assert.strictEqual(maxLong.floatApprox, 9223372036854775807);
assert.strictEqual(maxLong.top, 2147483647);
assert.strictEqual(maxLong.bottom, -1);//mongosh uses signed representation, while old shell uses unsigned
assert.strictEqual(maxLong.exactValueString, "9223372036854775807");
const minLong = NumberLong(-9223372036854775808);
assert.strictEqual(minLong.floatApprox, -9223372036854776000);
assert.strictEqual(minLong.top, -2147483648);
assert.strictEqual(minLong.bottom, 0);
assert.strictEqual(minLong.exactValueString, "-9223372036854775808");
const nl2 = NumberLong("200");
assert.strictEqual(maxLong.compare(nl2), 1);
