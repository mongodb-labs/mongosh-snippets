---
name: mongodb-performance
description: MongoDB Performance Tuning - Index optimization and query analysis
disable-model-invocation: false
---

# MongoDB Performance Tuning

You are an expert in MongoDB performance optimization.

## Reading Explain Plans

### Basic Explain
```javascript
db.collection.find({...}).explain()
db.collection.find({...}).explain("executionStats")
db.collection.find({...}).explain("allPlansExecution")
```

### Key Fields in explain("executionStats")

```javascript
{
  executionStats: {
    nReturned: 5,           // Documents returned
    totalDocsExamined: 1000, // Documents scanned (IXSCAN = index, COLLSCAN = collection)
    totalKeysExamined: 5,   // Index keys examined
    executionTimeMillis: 2, // Time in milliseconds
    stage: "IXSCAN",        // COLLSCAN, IXSCAN, FETCH, etc.
    inputStage: {
      stage: "IXSCAN",
      indexName: "field_1",
      keyPattern: { field: 1 }
    }
  }
}
```

### What to Look For

**Good signs:**
- `stage: "IXSCAN"` with `totalKeysExamined` close to `nReturned`
- `totalDocsExamined` equals `nReturned` (covered query)
- `executionTimeMillis` is low

**Bad signs:**
- `stage: "COLLSCAN"` (collection scan)
- `totalDocsExamined` much higher than `nReturned` (inefficient index)
- High `executionTimeMillis`

## Identifying Missing Indexes

### Slow Query Log
```javascript
// Enable profiling level 1 (slow ops only)
db.setProfilingLevel(1, { slowms: 100 })

// View slow queries
db.system.profile.find().sort({ ts: -1 }).limit(10)

// Disable profiling
db.setProfilingLevel(0)
```

### Common Index Candidates
- Fields in `find()` queries (especially equality matches)
- Fields in `sort()` operations
- Fields in aggregation `$match` stages
- Foreign key-like fields used in `$lookup`

## Creating Indexes Safely

### Best Practices
```javascript
// Check index doesn't exist first
db.collection.getIndexes()

// Create index in background (recommended for production)
db.collection.createIndex(
  { field: 1 },
  { background: true }
)

// For large collections, consider rolling index build
db.collection.createIndex(
  { field: 1 },
  { background: true, partialFilterExpression: { field: { $exists: true } } }
)
```

### Compound Index Strategy
```javascript
// Order: Equality → Sort → Range
// 1. Equality fields (single value)
// 2. Sort fields
// 3. Range fields ($gt, $lt, etc.)

// Example: Find active users, sort by createdAt, filter by age range
db.users.createIndex({
  status: 1,        // Equality
  createdAt: -1,    // Sort
  age: 1            // Range
})
```

## Spotting Collection Scans

### In Query Planner
```javascript
{
  stage: "COLLSCAN",
  direction: "forward"
}
```

### Common Causes
- Query on unindexed field
- `$nin`, `$ne`, `$not` operators (often can't use indexes)
- Regex without leading anchor: `/pattern/` (not `/^pattern/`)
- `$where` clauses
- Queries on fields inside arrays without multikey index

### Solutions
- Add index for the queried field
- Restructure query to avoid negation
- Use text index for search patterns
- Consider pre-computed fields

## Index Optimization

### Remove Unused Indexes
```javascript
// Check index usage stats
db.collection.aggregate([
  { $indexStats: {} }
])

// Drop unused indexes (be careful!)
db.collection.dropIndex("unused_index_name")
```

### Partial Indexes
```javascript
// Only index active users (saves space, faster)
db.users.createIndex(
  { email: 1 },
  { partialFilterExpression: { status: "active" } }
)
```

### Sparse Indexes
```javascript
// Only index documents where field exists
db.collection.createIndex(
  { optionalField: 1 },
  { sparse: true }
)
```

### TTL Indexes
```javascript
// Auto-delete old documents (e.g., logs)
db.logs.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 2592000 }  // 30 days
)
```

## Aggregation Pipeline Optimization

### Stage Ordering
```javascript
// GOOD: Filter early
db.orders.aggregate([
  { $match: { status: "shipped", date: { $gte: startDate } } },  // Use index
  { $group: { _id: "$customerId", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } },
  { $limit: 10 }
])

// BAD: Sort before filtering
db.orders.aggregate([
  { $sort: { date: -1 } },  // Expensive on large collection
  { $match: { status: "shipped" } }
])
```

### Memory Optimization
```javascript
// Allow disk use for large aggregations
db.collection.aggregate([...], { allowDiskUse: true })

// Use $project to reduce document size early
{ $project: { neededField: 1, computed: { $add: ["$a", "$b"] } } }
```

## Server Metrics to Monitor

### Key Metrics from serverStatus
```javascript
db.serverStatus().opcounters     // CRUD operation counts
db.serverStatus().connections   // Current connections
db.serverStatus().mem           // Memory usage
db.serverStatus().globalLock    // Lock contention
```

### WiredTiger Cache
```javascript
db.serverStatus().wiredTiger.cache
// Look for:
// - "bytes currently in the cache" vs available RAM
// - "pages evicted by application threads" (high = pressure)
```

## Query Patterns to Avoid

1. **Unbounded queries**: Always use limits
   ```javascript
   // BAD
db.logs.find({ level: "error" })
   // GOOD
   db.logs.find({ level: "error" }).limit(100)
   ```

2. **Large skip values**: Use cursor-based pagination
   ```javascript
   // BAD: skip 1000000 is slow
   db.collection.find().skip(1000000).limit(10)
   // GOOD: cursor-based
   db.collection.find({ _id: { $gt: lastId } }).limit(10)
   ```

3. **$lookup without index on foreign field**

4. **Updating large arrays**: Consider separate collection

5. **Unnecessary projections**: Project only needed fields

## When to Ask for Help

Complex performance issues involving:
- Sharding configuration and chunk distribution
- Replica set lag and replication issues
- Memory pressure and OOM crashes
- Lock contention in high-concurrency scenarios
- Storage engine (WiredTiger) tuning
