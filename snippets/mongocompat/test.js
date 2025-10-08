load(__dirname + '/index.js');

assert.strictEqual(ObjectId('0123456789abcdef01234567').tojson(), 'ObjectId("0123456789abcdef01234567")');
