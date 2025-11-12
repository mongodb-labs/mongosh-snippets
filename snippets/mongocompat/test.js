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

const decimal = NumberDecimal("1.1");
assert.strictEqual(decimal.toString(), 'NumberDecimal("1.1")');
assert.strictEqual(decimal.tojson(), 'NumberDecimal("1.1")');

const ts1 = Timestamp();
assert.strictEqual(ts1.toString(), 'Timestamp(0, 0)');
const ts2 = Timestamp(100, 200);
assert.strictEqual(ts2.toString(), 'Timestamp(100, 200)');
const ts3 = Timestamp(1.9, 2.1);
assert.strictEqual(ts3.toString(), 'Timestamp(1, 2)');
try {
    Timestamp(-1, 0);
    assert.fail('Should throw for negative time');
} catch (e) {
    assert(e.message.includes('must be non-negative'));
}
try {
    Timestamp(0, 5000000000);
    assert.fail('Should throw for i > uint32 max');
} catch (e) {
    assert(e.message.includes('not greater than 4294967295'));
}
const ts4 = Timestamp(123, 456);
assert(ts4 instanceof Timestamp);
assert.strictEqual(ts4.toString(), 'Timestamp(123, 456)');
assert.strictEqual(ts4.tojson(), 'Timestamp(123, 456)');
assert.strictEqual(ts4.getTime(), 123);
assert.strictEqual(ts4.getInc(), 456);
assert.strictEqual(ts4._bsontype, 'Timestamp');
const tsFromBits = Timestamp.fromBits(100, 200);
assert(tsFromBits instanceof Timestamp);
assert.strictEqual(tsFromBits.i, 100);
assert.strictEqual(tsFromBits.t, 200);
assert.strictEqual(tsFromBits.toString(), 'Timestamp(200, 100)');
const tsFromInt = Timestamp.fromInt(12345);
assert.strictEqual(tsFromInt._bsontype, 'Timestamp');
assert.strictEqual(tsFromInt.i, 12345);
assert.strictEqual(tsFromInt.t, 0);
const tsFromNum = Timestamp.fromNumber(67890);
assert.strictEqual(tsFromNum._bsontype, 'Timestamp');
assert.strictEqual(tsFromNum.i, 67890);
assert.strictEqual(tsFromNum.t, 0);
const tsFromStr = Timestamp.fromString('ff', 16);
assert.strictEqual(tsFromStr.i, 255);
assert.strictEqual(tsFromStr.t, 0);
assert.strictEqual(Timestamp.MAX_VALUE._bsontype, 'Long');
assert.strictEqual(Timestamp.MAX_VALUE, Long.MAX_UNSIGNED_VALUE); 

const id = ObjectId('68ffa28b77bba38c9ddcf376');
const dbRef = DBRef('testColl', id, 'testDb');
assert.strictEqual(dbRef.toString(), 'DBRef("testColl", ObjectId("68ffa28b77bba38c9ddcf376"), "testDb")');
assert.strictEqual(dbRef.tojson(), 'DBRef("testColl", ObjectId("68ffa28b77bba38c9ddcf376"), "testDb")');
assert.strictEqual(dbRef.$ref, 'testColl');
assert.strictEqual(dbRef.$id, id);
assert.strictEqual(dbRef.$db, 'testDb');
const dbRefNoDb = DBRef('testColl', id);
assert.strictEqual(dbRefNoDb.toString(), 'DBRef("testColl", ObjectId("68ffa28b77bba38c9ddcf376"))');
assert.strictEqual(dbRefNoDb.$db, undefined);
const dbRefStringId = DBRef('testColl', '68ffa28b77bba38c9ddcf376');
assert.strictEqual(dbRefStringId.toString(), 'DBRef("testColl", "68ffa28b77bba38c9ddcf376")');
const dbRefForSetters = DBRef('originalColl', id, 'originalDb');
dbRefForSetters.$ref = 'newColl';
assert.strictEqual(dbRefForSetters.$ref, 'newColl');
assert.strictEqual(dbRefForSetters.collection, 'newColl');
assert.strictEqual(dbRefForSetters.toString(), 'DBRef("newColl", ObjectId("68ffa28b77bba38c9ddcf376"), "originalDb")');
const newId = ObjectId('507f1f77bcf86cd799439011');
dbRefForSetters.$id = newId;
assert.strictEqual(dbRefForSetters.$id, newId);
assert.strictEqual(dbRefForSetters.oid, newId);
assert.strictEqual(dbRefForSetters.toString(), 'DBRef("newColl", ObjectId("507f1f77bcf86cd799439011"), "originalDb")');
dbRefForSetters.$db = 'newDb';
assert.strictEqual(dbRefForSetters.$db, 'newDb');
assert.strictEqual(dbRefForSetters.db, 'newDb');
assert.strictEqual(dbRefForSetters.toString(), 'DBRef("newColl", ObjectId("507f1f77bcf86cd799439011"), "newDb")');

try {
    tojsonObject("not an object");
    assert.fail('Should throw TypeError for string');
} catch (e) {
    assert(e instanceof TypeError);
    assert(e.message.includes('tojsonObject needs object, not [string]'));
}
try {
    tojsonObject(true);
    assert.fail('Should throw TypeError for boolean');
} catch (e) {
    assert(e.message.includes('tojsonObject needs object, not [boolean]'));
}
assert.strictEqual(typeof tojsonObject({ key: "value" }), 'string');
assert.strictEqual(typeof tojsonObject([1, 2, 3]), 'string');
