// Date and time types
if (typeof (Timestamp) != "undefined") {
    const OriginalTimestamp = Timestamp;

    // Reference: https://github.com/mongodb/mongo/blob/c4d21d3346572e28df2f174df4d87e7618df4a77/src/mongo/scripting/mozjs/timestamp.cpp#L67-L78
    function validateTimestampComponent(component, name) {
        const MAX_UINT32 = 4294967295; 

        if (typeof component !== 'number') {
            throw new TypeError(`${name} must be a number`);
        }

        const val = Math.floor(component);
        if (val < 0 || val > MAX_UINT32) {
            throw new TypeError(
                `${name} must be non-negative and not greater than ${MAX_UINT32}, got ${val}`
            );
        }

        return val;
    }

    Timestamp = function(t, i) {
        if (arguments.length === 0) {
            return new OriginalTimestamp({ t: 0, i: 0 });
        }

        if (arguments.length === 1) {
            const proto = Object.getPrototypeOf(t);
            if ((proto === null || proto === Object.prototype) && ('t' in t || 'i' in t)) {
                const validatedT = validateTimestampComponent(t.t || 0, "Timestamp time (seconds)");
                const validatedI = validateTimestampComponent(t.i || 0, "Timestamp increment");
                return new OriginalTimestamp({ t: validatedT, i: validatedI });
            }
            return new OriginalTimestamp(t);
        }

        // Reference: https://github.com/mongodb/mongo/blob/c4d21d3346572e28df2f174df4d87e7618df4a77/src/mongo/scripting/mozjs/timestamp.cpp#L91-L98
        if (arguments.length === 2) {
            const validatedT = validateTimestampComponent(t, "Timestamp time (seconds)");
            const validatedI = validateTimestampComponent(i, "Timestamp increment");
            return new OriginalTimestamp({ t: validatedT, i: validatedI });
        }

        throw new Error("Timestamp needs 0 or 2 arguments");
    };

    Timestamp.prototype = OriginalTimestamp.prototype;

    for (const key of Object.getOwnPropertyNames(OriginalTimestamp)) {
        // Skip prototype, length, name(function internals)
        if (key !== 'prototype' && key !== 'length' && key !== 'name') {
            Timestamp[key] = OriginalTimestamp[key];
        }
    }

    Timestamp.prototype.tojson = function() {
        return this.toStringIncomparable();
    };

    Timestamp.prototype.getTime = function() {
        return this.hasOwnProperty("t") ? this.t : this.high;
    };

    Timestamp.prototype.getInc = function() {
        return this.hasOwnProperty("i") ? this.i : this.low;
    };

    Timestamp.prototype.toString = function() {
        // Resmoke overrides `toString` to throw an error to prevent accidental operator
        // comparisons, e.g: >, -, etc...
        return this.toStringIncomparable();
    };

    Timestamp.prototype.toStringIncomparable = function() {
        var t = this.hasOwnProperty("t") ? this.t : this.high;
        var i = this.hasOwnProperty("i") ? this.i : this.low;
        return "Timestamp(" + t + ", " + i + ")";
    };
} else {
    print("warning: no Timestamp class");
}

Date.timeFunc = function(theFunc, numTimes) {
    var start = new Date();
    numTimes = numTimes || 1;
    for (var i = 0; i < numTimes; i++) {
        theFunc.apply(null, Array.from(arguments).slice(2));
    }

    return (new Date()).getTime() - start.getTime();
};

Date.prototype.tojson = function() {
    try {
        // If this === Date.prototype or this is a Date instance created from
        // Object.create(Date.prototype), then the [[DateValue]] internal slot won't be set and will
        // lead to a TypeError. We instead treat it as though the [[DateValue]] internal slot is NaN
        // in order to be consistent with the ES5 behavior in MongoDB 3.2 and earlier.
        this.getTime();
    } catch (e) {
        if (e instanceof TypeError &&
            e.message.includes("getTime method called on incompatible Object")) {
            return new Date(NaN).tojson();
        }
        throw e;
    }

    var UTC = 'UTC';
    var year = this['get' + UTC + 'FullYear']().zeroPad(4);
    var month = (this['get' + UTC + 'Month']() + 1).zeroPad(2);
    var date = this['get' + UTC + 'Date']().zeroPad(2);
    var hour = this['get' + UTC + 'Hours']().zeroPad(2);
    var minute = this['get' + UTC + 'Minutes']().zeroPad(2);
    var sec = this['get' + UTC + 'Seconds']().zeroPad(2);

    if (this['get' + UTC + 'Milliseconds']())
        sec += '.' + this['get' + UTC + 'Milliseconds']().zeroPad(3);

    var ofs = 'Z';
    // // print a non-UTC time
    // var ofsmin = this.getTimezoneOffset();
    // if (ofsmin != 0){
    //     ofs = ofsmin > 0 ? '-' : '+'; // This is correct
    //     ofs += (ofsmin/60).zeroPad(2)
    //     ofs += (ofsmin%60).zeroPad(2)
    // }
    return 'ISODate("' + year + '-' + month + '-' + date + 'T' + hour + ':' + minute + ':' + sec +
        ofs + '")';
};

ISODate = function(isoDateStr) {
    if (!isoDateStr)
        return new Date();

    var isoDateRegex =
        /^(\d{4})-?(\d{2})-?(\d{2})([T ](\d{2})(:?(\d{2})(:?(\d{2}(\.\d+)?))?)?(Z|([+-])(\d{2}):?(\d{2})?)?)?$/;
    var res = isoDateRegex.exec(isoDateStr);

    if (!res)
        throw Error("invalid ISO date: " + isoDateStr);

    var year = parseInt(res[1], 10);
    var month = (parseInt(res[2], 10)) - 1;
    var date = parseInt(res[3], 10);
    var hour = parseInt(res[5], 10) || 0;
    var min = parseInt(res[7], 10) || 0;
    var sec = parseInt((res[9] && res[9].substr(0, 2)), 10) || 0;
    var ms = Math.round((parseFloat(res[10]) || 0) * 1000);

    var dateTime = new Date();

    dateTime.setUTCFullYear(year, month, date);
    dateTime.setUTCHours(hour);
    dateTime.setUTCMinutes(min);
    dateTime.setUTCSeconds(sec);
    var time = dateTime.setUTCMilliseconds(ms);

    if (res[11] && res[11] != 'Z') {
        var ofs = 0;
        ofs += (parseInt(res[13], 10) || 0) * 60 * 60 * 1000;  // hours
        ofs += (parseInt(res[14], 10) || 0) * 60 * 1000;       // mins
        if (res[12] == '+')                                    // if ahead subtract
            ofs *= -1;

        time += ofs;
    }

    // If we are outside the range 0000-01-01T00:00:00.000Z - 9999-12-31T23:59:59.999Z, abort with
    // error.
    const DATE_RANGE_MIN_MICROSECONDS = -62167219200000;
    const DATE_RANGE_MAX_MICROSECONDS = 253402300799999;

    if (time < DATE_RANGE_MIN_MICROSECONDS || time > DATE_RANGE_MAX_MICROSECONDS)
        throw Error("invalid ISO date: " + isoDateStr);

    return new Date(time);
};

// Regular Expression
RegExp.escape = function(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

RegExp.prototype.tojson = RegExp.prototype.toString;

// Array
Array.contains = function(a, x) {
    if (!Array.isArray(a)) {
        throw new Error("The first argument to Array.contains must be an array");
    }

    for (var i = 0; i < a.length; i++) {
        if (a[i] == x)
            return true;
    }
    return false;
};

Array.unique = function(a) {
    if (!Array.isArray(a)) {
        throw new Error("The first argument to Array.unique must be an array");
    }

    var u = [];
    for (var i = 0; i < a.length; i++) {
        var o = a[i];
        if (!Array.contains(u, o)) {
            u.push(o);
        }
    }
    return u;
};

Array.shuffle = function(arr) {
    if (!Array.isArray(arr)) {
        throw new Error("The first argument to Array.shuffle must be an array");
    }

    for (var i = 0; i < arr.length - 1; i++) {
        var pos = i + Random.randInt(arr.length - i);
        var save = arr[i];
        arr[i] = arr[pos];
        arr[pos] = save;
    }
    return arr;
};

Array.tojson = function(a, indent, nolint, depth) {
    if (!Array.isArray(a)) {
        throw new Error("The first argument to Array.tojson must be an array");
    }

    if (typeof depth !== 'number') {
        depth = 0;
    }
    if (depth > tojson.MAX_DEPTH) {
        return "[Array]";
    }

    var elementSeparator = nolint ? " " : "\n";

    if (!indent)
        indent = "";
    if (nolint)
        indent = "";

    if (a.length == 0) {
        return "[ ]";
    }

    var s = "[" + elementSeparator;

    // add to indent if we are pretty
    if (!nolint)
        indent += "\t";

    for (var i = 0; i < a.length; i++) {
        s += indent + tojson(a[i], indent, nolint, depth + 1, false);
        if (i < a.length - 1) {
            s += "," + elementSeparator;
        }
    }

    // remove from indent if we are pretty
    if (!nolint)
        indent = indent.substring(1);

    s += elementSeparator + indent + "]";
    return s;
};

Array.fetchRefs = function(arr, coll) {
    if (!Array.isArray(arr)) {
        throw new Error("The first argument to Array.fetchRefs must be an array");
    }

    var n = [];
    for (var i = 0; i < arr.length; i++) {
        var z = arr[i];
        if (coll && coll != z.getCollection())
            continue;
        n.push(z.fetch());
    }
    return n;
};

Array.sum = function(arr) {
    if (!Array.isArray(arr)) {
        throw new Error("The first argument to Array.sum must be an array");
    }

    if (arr.length == 0)
        return null;
    var s = arr[0];
    for (var i = 1; i < arr.length; i++)
        s += arr[i];
    return s;
};

Array.avg = function(arr) {
    if (!Array.isArray(arr)) {
        throw new Error("The first argument to Array.avg must be an array");
    }

    if (arr.length == 0)
        return null;
    return Array.sum(arr) / arr.length;
};

Array.stdDev = function(arr) {
    if (!Array.isArray(arr)) {
        throw new Error("The first argument to Array.stdDev must be an array");
    }

    var avg = Array.avg(arr);
    var sum = 0;

    for (var i = 0; i < arr.length; i++) {
        sum += Math.pow(arr[i] - avg, 2);
    }

    return Math.sqrt(sum / arr.length);
};

// Object
Object.extend = function(dst, src, deep) {
    for (var k in src) {
        var v = src[k];
        if (deep && typeof (v) == "object" && v !== null) {
            if (v.constructor === ObjectId) {  // convert ObjectId properly
                eval("v = " + tojson(v));
            } else if ("floatApprox" in v) {  // convert NumberLong properly
                eval("v = " + tojson(v));
            } else {
                v = Object.extend(typeof (v.length) == "number" ? [] : {}, v, true);
            }
        }
        dst[k] = v;
    }
    return dst;
};

Object.merge = function(dst, src, deep) {
    var clone = Object.extend({}, dst, deep);
    return Object.extend(clone, src, deep);
};

Object.keySet = function(o) {
    var ret = new Array();
    for (var i in o) {
        if (!(i in o.__proto__ && o[i] === o.__proto__[i])) {
            ret.push(i);
        }
    }
    return ret;
};

// mongosh-specific addition
Object.bsonsize = bsonsize;

// String
if (String.prototype.trim === undefined) {
    String.prototype.trim = function() {
        return this.replace(/^\s+|\s+$/g, "");
    };
}
if (String.prototype.trimLeft === undefined) {
    String.prototype.trimLeft = function() {
        return this.replace(/^\s+/, "");
    };
}
if (String.prototype.trimRight === undefined) {
    String.prototype.trimRight = function() {
        return this.replace(/\s+$/, "");
    };
}

// always provide ltrim and rtrim for backwards compatibility
String.prototype.ltrim = String.prototype.trimLeft;
String.prototype.rtrim = String.prototype.trimRight;

String.prototype.startsWith = function(str) {
    return this.indexOf(str) == 0;
};

String.prototype.endsWith = function(str) {
    return this.indexOf(str, this.length - str.length) !== -1;
};

// Polyfill taken from
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes
if (!String.prototype.includes) {
    String.prototype.includes = function() {
        'use strict';
        return String.prototype.indexOf.apply(this, arguments) !== -1;
    };
}

// Returns a copy padded with the provided character _chr_ so it becomes (at least) _length_
// characters long.
// No truncation is performed if the string is already longer than _length_.
// @param length minimum length of the returned string
// @param right if falsy add leading whitespace, otherwise add trailing whitespace
// @param chr character to be used for padding, defaults to whitespace
// @return the padded string
String.prototype.pad = function(length, right, chr) {
    if (typeof chr == 'undefined')
        chr = ' ';
    var str = this;
    for (var i = length - str.length; i > 0; i--) {
        if (right) {
            str = str + chr;
        } else {
            str = chr + str;
        }
    }
    return str;
};

// Number
Number.prototype.toPercentStr = function() {
    return (this * 100).toFixed(2) + "%";
};

Number.prototype.zeroPad = function(width) {
    return ('' + this).pad(width, false, '0');
};

// NumberLong
if (!NumberLong.prototype) {
    NumberLong.prototype = {};
}

NumberLong.prototype.nativeToString = NumberLong.prototype.toString;
NumberLong.prototype.toString = function () {
    const INT32_MIN = -2147483648;
    const INT32_MAX = 2147483647;

    const numValue = this.toNumber ? this.toNumber() : Number(this);
    if (numValue >= INT32_MIN && numValue <= INT32_MAX && Number.isInteger(numValue)) {
        return `NumberLong(${numValue})`;
    }
    return `NumberLong("${this.exactValueString}")`;
};

NumberLong.prototype.tojson = function() {
    return this.toString();
};

Object.defineProperty(NumberLong.prototype, 'floatApprox', {
    enumerable: false,
    configurable: true,
    get: function() {
        return this.toNumber ? this.toNumber() : Number(this);
    }
});

Object.defineProperty(NumberLong.prototype, 'top', {
    enumerable: false,
    configurable: true,
    get: function() {
        return this.high;
    }
});

Object.defineProperty(NumberLong.prototype, 'bottom', {
    enumerable: false,
    configurable: true,
    get: function() {
        return this.low;
    }
});

Object.defineProperty(NumberLong.prototype, 'exactValueString', {
    enumerable: false,
    configurable: true,
    get: function() {
        const high = BigInt(this.high);
        const low = BigInt(this.low >>> 0);
        const value = (high << 32n) | low;
        return value.toString();
    }
});

// NumberInt
if (!NumberInt.prototype) {
    NumberInt.prototype = {};
}
NumberInt.prototype.nativeToString = NumberInt.prototype.toString;
NumberInt.prototype.toString = function() {
    return `NumberInt(${this.valueOf()})`;
};
NumberInt.prototype.tojson = function() {
    return this.toString();
};
NumberInt.prototype.toNumber = function() {
    return this.valueOf();
};

// NumberDecimal
if (typeof NumberDecimal !== 'undefined') {
    if (!NumberDecimal.prototype) {
        NumberDecimal.prototype = {};
    }

    NumberDecimal.prototype.nativeToString = NumberDecimal.prototype.toString
    NumberDecimal.prototype.toString = function() {
        return `NumberDecimal("${this.nativeToString()}")`;
    };

    NumberDecimal.prototype.tojson = function() {
        return this.toString();
    };
}

// ObjectId
if (!ObjectId.prototype)
    ObjectId.prototype = {};

ObjectId.prototype.toString = function() {
    return this.inspect();
};

ObjectId.prototype.tojson = function() {
    return this.toString();
};

Object.defineProperty(ObjectId.prototype, 'str', {
  enumerable: true,
  get() {
    return this.toHexString();
  }
});

ObjectId.prototype.valueOf = function() {
    return this.str;
};

ObjectId.prototype.isObjectId = true;

ObjectId.prototype.getTimestamp = function() {
    return new Date(parseInt(this.valueOf().slice(0, 8), 16) * 1000);
};

ObjectId.prototype.equals = function(other) {
    return this.str == other.str;
};

// Creates an ObjectId from a Date.
// Based on solution discussed here:
//     http://stackoverflow.com/questions/8749971/can-i-query-mongodb-objectid-by-date
ObjectId.fromDate = function(source) {
    if (!source) {
        throw Error("date missing or undefined");
    }

    var sourceDate;

    // Extract Date from input.
    // If input is a string, assume ISO date string and
    // create a Date from the string.
    if (source instanceof Date) {
        sourceDate = source;
    } else {
        throw Error("Cannot create ObjectId from " + typeof (source) + ": " + tojson(source));
    }

    // Convert date object to seconds since Unix epoch.
    var seconds = Math.floor(sourceDate.getTime() / 1000);

    // Generate hex timestamp with padding.
    var hexTimestamp = seconds.toString(16).pad(8, false, '0') + "0000000000000000";

    // Create an ObjectId with hex timestamp.
    var objectId = ObjectId(hexTimestamp);

    return objectId;
};

// DBPointer
if (typeof (DBPointer) != "undefined") {
    DBPointer.prototype.fetch = function() {
        assert(this.ns, "need a ns");
        assert(this.id, "need an id");
        return db[this.ns].findOne({_id: this.id});
    };

    DBPointer.prototype.tojson = function(indent) {
        return this.toString();
    };

    DBPointer.prototype.getCollection = function() {
        return this.ns;
    };

    DBPointer.prototype.getId = function() {
        return this.id;
    };

    DBPointer.prototype.toString = function() {
        return "DBPointer(" + tojson(this.ns) + ", " + tojson(this.id) + ")";
    };
} else {
    // print("warning: no DBPointer");
}

// DBRef
if (typeof (DBRef) != "undefined") {
    DBRef.prototype.fetch = function() {
        assert(this.collection, "need a ns");
        assert(this.oid, "need an id");
        var coll = this.db ? db.getSiblingDB(this.db).getCollection(this.collection) : db[this.collection];
        return coll.findOne({_id: this.oid});
    };

    DBRef.prototype.tojson = function(indent) {
        return this.toString();
    };

    DBRef.prototype.getDb = function() {
        return this.db || undefined;
    };

    DBRef.prototype.getCollection = function() {
        return this.collection;
    };

    DBRef.prototype.getRef = function() {
        return this.collection;
    };

    DBRef.prototype.getId = function() {
        return this.oid;
    };

    DBRef.prototype.toString = function() {
        return `DBRef("${this.collection}", ${tojson(this.oid)}` +
            (this.db ? `, "${this.db}"` : "") + ")";
    };

    Object.defineProperty(DBRef.prototype, "$ref", {
        get: function () {
            return this.collection;
        },
        set: function (value) {
            this.collection = value;
        },
    });
    Object.defineProperty(DBRef.prototype, "$id", {
        get: function () {
            return this.oid;
        },
        set: function (value) {
            this.oid = value;
        },
    });
    Object.defineProperty(DBRef.prototype, "$db", {
        get: function () {
            return this.db;
        },
        set: function (value) {
            this.db = value;
        },
    });
} else {
    print("warning: no DBRef");
}

// BinData
if (typeof (BinData) != "undefined") {
    BinData.prototype.tojson = function() {
        return this.toString();
    };

    BinData.prototype.subtype = function() {
        return this.type;
    };
    BinData.prototype.length = function() {
        return this.len;
    };

    BinData.prototype.nativeToString = BinData.prototype.toString;
    BinData.prototype.toString = function (encoding) {
        if (encoding) {
            return this.nativeToString(encoding);
        }
        return `BinData(${this.type},"${this.base64()}")`;
    };

    BinData.prototype.base64 = function () {
        return this.toString("base64");
    };
    BinData.prototype.hex = function () {
        return this.toString("hex");
    };
    Object.defineProperty(BinData.prototype, "len", {
        get: function () {
            return this.buffer ? this.buffer.byteLength : 0;
        },
    });
    Object.defineProperty(BinData.prototype, "type", {
        get: function () {
            return this.sub_type;
        },
    });
} else {
    print("warning: no BinData class");
}

if (typeof (gc) == "undefined") {
    gc = function() {
        print("warning: using noop gc()");
    };
}

// Free Functions
tojsononeline = function(x) {
    return tojson(x, " ", true);
};

tojson = function(x, indent, nolint, depth, sortKeys) {
    if (x === null)
        return "null";

    if (x === undefined)
        return "undefined";

    if (!indent)
        indent = "";

    if (typeof depth !== 'number') {
        depth = 0;
    }

    switch (typeof x) {
        case "string":
            return JSON.stringify(x);
        case "number":
        case "boolean":
            return "" + x;
        case "object": {
            var s = tojsonObject(x, indent, nolint, depth, sortKeys);
            if ((nolint == null || nolint == true) && s.length < 80 &&
                (indent == null || indent.length == 0)) {
                s = s.replace(/[\t\r\n]+/gm, " ");
            }
            return s;
        }
        case "function":
            if (x === MinKey || x === MaxKey)
                return x.tojson();
            return x.toString();
        default:
            throw Error("tojson can't handle type " + (typeof x));
    }
};
tojson.MAX_DEPTH = 100;

tojsonObject = function(x, indent, nolint, depth, sortKeys) {
    if (typeof depth !== 'number') {
        depth = 0;
    }
    if (typeof sortKeys !== 'boolean') {
        sortKeys = false;
    }
    var lineEnding = nolint ? " " : "\n";
    var tabSpace = nolint ? "" : "\t";
    if (typeof x !== "object") {
        throw new TypeError(`tojsonObject needs object, not [${typeof x}]`);
    }

    if (!indent)
        indent = "";

    if (typeof (x.tojson) == "function" && x.tojson != tojson) {
        return x.tojson(indent, nolint, depth, sortKeys);
    }

    if (x.constructor && typeof (x.constructor.tojson) == "function" &&
        x.constructor.tojson != tojson) {
        return x.constructor.tojson(x, indent, nolint, depth, sortKeys);
    }

    if (x instanceof Error) {
        return x.toString();
    }

    try {
        x.toString();
    } catch (e) {
        // toString not callable
        return "[Object]";
    }

    if (depth > tojson.MAX_DEPTH) {
        return "[Object]";
    }

    var s = "{" + lineEnding;

    // push one level of indent
    indent += tabSpace;

    var keys = x;
    if (typeof (x._simpleKeys) == "function")
        keys = x._simpleKeys();
    var keyNames = [];
    for (var k in keys) {
        keyNames.push(k);
    }
    if (sortKeys) keyNames.sort();

    var fieldStrings = [];
    for (var k of keyNames) {
        var val = x[k];

        // skip internal DB types to avoid issues with interceptors
        if (typeof DB != 'undefined' && val == DB.prototype)
            continue;
        if (typeof DBCollection != 'undefined' && val == DBCollection.prototype)
            continue;

        fieldStrings.push(indent + "\"" + k + "\" : " + tojson(val, indent, nolint, depth + 1, sortKeys));
    }

    if (fieldStrings.length > 0) {
        s += fieldStrings.join("," + lineEnding);
    } else {
        s += indent;
    }
    s += lineEnding;

    // pop one level of indent
    indent = indent.substring(1);
    return s + indent + "}";
};

printjson = function(x) {
    print(tojson(x));
};

printjsononeline = function(x) {
    print(tojsononeline(x));
};

isString = function(x) {
    return typeof (x) == "string";
};

isNumber = function(x) {
    return typeof (x) == "number";
};

// This function returns true even if the argument is an array.  See SERVER-14220.
isObject = function(x) {
    return typeof (x) == "object";
};
