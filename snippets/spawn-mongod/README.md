# spawn-mongod

Spin up a local mongod process.

```js
// Copy data from a collection on the current server to a new server:
> const mongod = spawnMongod({ version: 'latest', port: 27097 })
> mongod.waitReady
listening!
> db.coll.find().forEach(doc => mongod.getDB('test').coll.insertOne(doc))
```
