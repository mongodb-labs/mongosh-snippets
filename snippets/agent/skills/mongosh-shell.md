---
name: mongosh-shell
description: mongosh Shell Guide - Available helpers and commands
disable-model-invocation: false
---

# mongosh Shell Guide

You are running inside mongosh, the MongoDB Shell. You have access to the full mongosh API.

## Connection and Database Commands

### Show Information
```javascript
// Show all databases
show dbs

// Switch to database
use databaseName

// Show collections in current database
show collections
show tables

// Get current database name
db.getName()

// Get MongoDB connection
db.getMongo()
```

### Database Operations
```javascript
// Get database stats
db.stats()

// Current operation
db.currentOp()

// Kill an operation
db.killOp(opid)

// Server status
db.serverStatus()

// Build info
db.getMongo().getDB("admin").adminCommand({ buildInfo: 1 })
```

## Collection Operations

```javascript
// Get collection
db.getCollection("myCollection")
db.myCollection  // shorthand

// Collection stats
db.myCollection.stats()

// Collection count
db.myCollection.countDocuments()
db.myCollection.estimatedDocumentCount()

// Distinct values
db.myCollection.distinct("fieldName")

// Find one document
db.myCollection.findOne()

// Find with projection
db.myCollection.find({}, { name: 1, _id: 0 })
```

## Index Commands

```javascript
// Create index
db.myCollection.createIndex({ fieldName: 1 })  // 1 = ascending, -1 = descending
db.myCollection.createIndex({ fieldName: "text" })  // text index
db.myCollection.createIndex({ fieldName: 1 }, { unique: true })

// List indexes
db.myCollection.getIndexes()

// Drop index
db.myCollection.dropIndex("index_name")
db.myCollection.dropIndex({ fieldName: 1 })

// Drop all indexes (except _id)
db.myCollection.dropIndexes()

// Hide/unhide index (MongoDB 4.4+)
db.myCollection.hideIndex("index_name")
db.myCollection.unhideIndex("index_name")
```

## Replica Set Commands

```javascript
// Check replica set status
rs.status()

// Check if primary
rs.isMaster()

// Step down primary (if you are primary)
rs.stepDown()

// Reconfigure replica set
rs.reconfig(config)

// Add/remove members
rs.add("hostname:port")
rs.remove("hostname:port")
```

## Sharding Commands

```javascript
// Check sharding status
sh.status()

// Check balancer status
sh.getBalancerState()

// Start/stop balancer
sh.startBalancer()
sh.stopBalancer()

// Check chunk distribution
sh.getShardDistribution()
```

## User Management

```javascript
// Create user
db.createUser({
  user: "myUser",
  pwd: "myPassword",
  roles: [{ role: "readWrite", db: "myDatabase" }]
})

// Grant roles
db.grantRolesToUser("myUser", [{ role: "dbAdmin", db: "myDatabase" }])

// List users
db.getUsers()

// Drop user
db.dropUser("myUser")
```

## Helper Functions

```javascript
// Print JSON prettily
JSON.stringify(doc, null, 2)

// Current date
new Date()
ISODate()

// ObjectId operations
ObjectId()
ObjectId("...").getTimestamp()

// Timestamp
Timestamp()

// NumberLong, NumberInt, NumberDecimal
NumberLong("123456789012")
NumberDecimal("123.456")
```

## Aggregation Helpers

```javascript
// Run aggregation
db.myCollection.aggregate([
  { $match: { status: "active" } },
  { $group: { _id: "$category", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])

// Explain aggregation
db.myCollection.explain("executionStats").aggregate([...])
```

## Session and Transactions

```javascript
// Start session
const session = db.getMongo().startSession()

// Start transaction
session.startTransaction()

// Use session for operations
session.getDatabase("mydb").myCollection.findOne()

// Commit/abort
session.commitTransaction()
session.abortTransaction()

// End session
session.endSession()
```

## Useful Tips

- Use `.pretty()` or `.toArray()` for readable output: `db.col.find().pretty()`
- The shell remembers command history
- Use `<tab>` for autocomplete
- Access JavaScript standard library: `Math`, `Date`, `JSON`, etc.
- Load external scripts: `load("/path/to/script.js")`
- Set shell variables: `var myVar = db.collection.findOne()`

## Connection String Info

```javascript
// Check connection string (with credentials redacted)
db.getMongo().connectionInfo

// Get URI
db.getMongo().connectionURI
```
