(() => {
  const localRequire = require('module').createRequire(__filename);
  const bson = localRequire('bson');
  const util = localRequire('util');
  const vm = localRequire('vm');

  class MockCollection {
    constructor(docs) {
      this._docs = bson.deserialize(bson.serialize({ docs })).docs;
      for (const doc of this._docs) {
        if (!doc._id) doc._id = ObjectId();
      }
    }

    bulkWrite() { throw new Error('mock collection not writable'); }
    deleteMany() { throw new Error('mock collection not writable'); }
    deleteOne() { throw new Error('mock collection not writable'); }
    findAndModify() { throw new Error('mock collection not writable'); }
    findOneAndDelete() { throw new Error('mock collection not writable'); }
    findOneAndReplace() { throw new Error('mock collection not writable'); }
    findOneAndUpdate() { throw new Error('mock collection not writable'); }
    renameCollection() { throw new Error('mock collection not writable'); }
    insertMany() { throw new Error('mock collection not writable'); }
    insertOne() { throw new Error('mock collection not writable'); }
    insert() { throw new Error('mock collection not writable'); }
    remove() { throw new Error('mock collection not writable'); }
    save() { throw new Error('mock collection not writable'); }
    replaceOne() { throw new Error('mock collection not writable'); }
    update() { throw new Error('mock collection not writable'); }
    updateOne() { throw new Error('mock collection not writable'); }
    updateMany() { throw new Error('mock collection not writable'); }
    convertToCapped() { throw new Error('mock collection not writable'); }
    createIndex() { throw new Error('mock collection not writable'); }
    createIndexes() { throw new Error('mock collection not writable'); }
    ensureIndex() { throw new Error('mock collection not writable'); }
    dropIndex() { throw new Error('mock collection not writable'); }
    dropIndexes() { throw new Error('mock collection not writable'); }
    hideIndex() { throw new Error('mock collection not writable'); }
    unhideIndex() { throw new Error('mock collection not writable'); }
    runCommand() { throw new Error('mock collection not writable'); }
    runCommandWithCheck() { throw new Error('mock collection not writable'); }
    initializeOrderedBulkOp() { throw new Error('mock collection not writable'); }
    initializeUnorderedBulkOp() { throw new Error('mock collection not writable'); }
    explain() { throw new Error('cannot create explainable object from mock collection'); }
    getPlanCache() { throw new Error('cannot create plan cache from mock collection'); }
    validate() { throw new Error('cannot validate mock collection'); }
    watch() { throw new Error('cannot watch mock collection'); }
    getShardDistribution() { throw new Error('cannot get sharding info for mock collection'); }
    reIndex() {}
    drop() {}

    aggregate(...args) {
      let options;
      let pipeline;
      if (args.length === 0 || Array.isArray(args[0])) {
        options = args[1] || {};
        pipeline = args[0] || [];
      } else {
        options = {};
        pipeline = args || [];
      }
      pipeline = [
        { $limit: 1 },
        { $count: 'dummy' },
        { $set: { values: this._docs }},
        { $unwind: '$values'},
        { $replaceRoot: { newRoot: '$values' } },
        ...pipeline
      ];
      options = {
        ...options,
        readPreference: 'secondaryPreferred'
      };
      return db.getSiblingDB('admin').getCollection('system.version').aggregate(pipeline, options);
    }

    count(query, options) {
      return this.countDocuments(query, options);
    }

    countDocuments(query, options) {
      return this.aggregate([{ $match: query || {} }, { $count: 'count' }], options).next().count;
    }

    estimatedDocumentCount() {
      return this._docs.length;
    }

    distinct(field, query, options) {
      return this.aggregate([
        { $match: query || {} },
        { $group: { _id: '$' + field } }
      ], options).toArray().map(({ _id }) => _id);
    }

    find(query, projection) {
      const pipeline = [ { $match: query || {} } ];
      if (projection) {
        pipeline.push({ $project: projection });
      }
      return this.aggregate(pipeline);
    }

    findOne(query, projection) {
      return this.find(query, projection).next();
    }

    isCapped() {
      return false;
    }

    getIndexes() {
      return [ { v: 2, key: { _id: 1 }, name: '_id_' } ];
    }

    getIndexSpecs() {
      return this.getIndexes();
    }

    getIndices() {
      return this.getIndexes();
    }

    getIndexKeys() {
      return this.getIndexes().map(ix => ix.key);
    }

    totalIndexSize() {
      return 0;
    }

    getDB() {
      return null;
    }

    getMongo() {
      return null;
    }

    dataSize() {
      return this.aggregate([{ $group: { _id: null, size: { $sum: { $bsonSize: '$$ROOT' } } } } ]);
    }

    storageSize() {
      return this.dataSize();
    }

    totalSize() {
      return this.storageSize();
    }

    exists() {
      return this._docs.length > 0;
    }

    getFullName() {
      return '.mock';
    }

    getName() {
      return '.mock';
    }

    stats() {
      const size = this.totalSize();
      const count = this._docs.length;
      return {
        ns: this.getFullName(),
        size,
        count,
        avgObjSize: size / count,
        storageSize: size,
        freeStorageSize: 0,
        capped: this.isCapped(),
        wiredTiger: null,
        nindexes: 1,
        indexBuilds: [],
        totalIndexSize: 0,
        totalSize: size,
        indexSizes: { _id_: 0 },
        scaleFactor: 1,
        ok: 1
      };
    }

    latencyStats() {
      return [
        {
          ns: this.getFullName(),
          host: '',
          localTime: new Date(),
          latencyStats: {
            reads: { latency: 0, ops: 0 },
            writes: { latency: 0, ops: 0 },
            commands: { latency: 0, ops: 0 },
            transactions: { latency: 0, ops: 0 },
          }
        }
      ];
    }

    mapReduce(map, reduce, opts) {
      if (!opts) {
        opts = { out: { inline: 1 } };
      }
      const mapResult = new Map();
      const contextObj = Object.create(globalThis);
      contextObj.emit = function(key, val) {
        if (mapResult.has(key)) {
          mapResult.get(key).push(val);
        } else {
          mapResult.set(key, [val]);
        }
      };
      const { mapf, reducef } = vm.runInContext(`({
        mapf: ${map.toString()}, reducef: ${reduce.toString()}
      })`, vm.createContext(contextObj));
      for (const doc of this._docs) {
        mapf.call(doc);
      }
      const results = [];
      for (const [key, values] of mapResult) {
        results.push({ _id: key, value: reducef(key, values) });
      }
      if (typeof opts === 'string') {
        opts = { out: opts };
      }
      if (opts.out.inline) {
        return { results, ok: 1 };
      }
      db[opts.out].insertMany(results);
      return { result: opts.out, ok: 1 };
    }

    getShardVersion() {
      return {
        configServer: '',
        inShardedMode: false,
        mine: Timestamp(0, 0),
        global: 'UNKNOWN',
        ok: 1
      };
    }
  }

  globalThis.mockCollection = function(documents) {
    return new MockCollection([...documents]);
  };
})();
