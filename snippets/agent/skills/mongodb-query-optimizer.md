---
name: mongodb-query-optimizer
description: Help with MongoDB query optimization and indexing. Use only when the user asks for optimization or performance - "How do I optimize this query?", "How do I index this?", "Why is this query slow?", "Can you fix my slow queries?", "What are the slow queries on my cluster?", etc. Do not invoke for general MongoDB query writing unless user asks for performance or index help. Prefer indexing as optimization strategy.
disable-model-invocation: false
---

# MongoDB Query Optimizer

## When this skill is invoked

Invoke **only** when the user wants:

- Query/index **optimization** or **performance** help 
- **Why** a query is slow or **how to speed it up** 
- **How to index** a specific query
- **Slow queries** on their cluster and/or **how to optimize them**

Do **not** invoke for routine query authoring unless the user has requested help with optimization, slow queries, or indexing.

## High Level Workflow

### General Performance Help

If the user wants to examine slow queries, or is looking for general performance suggestions (not regarding any particular query):

1. Check the profiling level and slow query log using mongosh_eval:
   ```javascript
   // Enable profiling level 1 (slow ops only, >100ms)
   db.setProfilingLevel(1, { slowms: 100 })
   
   // View recent slow queries
   db.system.profile.find().sort({ ts: -1 }).limit(10)
   
   // Check server status for metrics
   db.serverStatus()
   ```

2. Check index usage stats across collections:
   ```javascript
   // For a specific collection
   db.collection.aggregate([{ $indexStats: {} }])
   ```

### Help with a Specific Query

If the user is asking about a particular query:

1. **Get existing indexes** using mongosh_eval:
   ```javascript
   db.collection.getIndexes()
   ```

2. **Run explain** to analyze the query plan:
   ```javascript
   // Basic explain
   db.collection.find({...}).explain()
   
   // Execution stats for detailed analysis
   db.collection.find({...}).explain("executionStats")
   
   // All plans execution to compare different approaches
   db.collection.find({...}).explain("allPlansExecution")
   ```

3. **Get a sample document** to understand the schema:
   ```javascript
   db.collection.find().limit(1)
   ```

## Using Explain Output

### Key Fields in explain("executionStats")

```javascript
{
  executionStats: {
    nReturned: 5,              // Documents returned
    totalDocsExamined: 1000,   // Documents scanned
    totalKeysExamined: 5,      // Index keys examined
    executionTimeMillis: 2,    // Time in milliseconds
    stage: "IXSCAN",           // COLLSCAN, IXSCAN, FETCH, etc.
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

## Example Workflow 1 (help with specific query)

**User:** "Why is this query slow? `db.orders.find({status: 'shipped', region: 'US'}).sort({date: -1})`"

1. **Check existing collection indexes:**
   ```javascript
   db.orders.getIndexes()
   ```
   - Result shows: `{_id: 1}`, `{status: 1}`, `{date: -1}`

2. **Run explain:**
   ```javascript
   db.orders.find(
     {status: 'shipped', region: 'US'}
   ).sort({date: -1}).explain("executionStats")
   ```
   - Result: Uses `{status: 1}` index, then in-memory SORT
   - `totalKeysExamined: 50000`, `nReturned: 100`

3. **Diagnose:** The query targets 100 docs but scans 50K index entries. In-memory sort adds overhead. Index doesn't support both filter fields or sort.

4. **Recommend:** Create compound index `{status: 1, region: 1, date: -1}` following ESR (two equality fields, then sort).

## Indexing Best Practices

### Creating Indexes Safely

```javascript
// Check index doesn't exist first
db.collection.getIndexes()

// Create index in background (recommended for production)
db.collection.createIndex(
  { field: 1 },
  { background: true }
)

// Compound index following ESR rule
// Equality → Sort → Range
db.orders.createIndex({
  status: 1,        // Equality
  createdAt: -1,    // Sort
  age: 1            // Range
})
```

### Common Index Candidates
- Fields in `find()` queries (especially equality matches)
- Fields in `sort()` operations
- Fields in aggregation `$match` stages
- Foreign key-like fields used in `$lookup`

### When Queries Use Indexes
- Equality matches on index prefix
- Range queries on index fields (use bounded ranges)
- Sorting on indexed fields
- Covered queries (all fields in index)

### When Indexes Are Ignored
- `$nin`, `$ne`, `$not` often can't use indexes effectively
- Regex without prefix anchor `/^pattern/`
- `$where` clauses
- Large `$in` arrays (threshold varies)

### Specialized Index Types

```javascript
// Partial index (only index active users)
db.users.createIndex(
  { email: 1 },
  { partialFilterExpression: { status: "active" } }
)

// Sparse index (only index documents where field exists)
db.collection.createIndex(
  { optionalField: 1 },
  { sparse: true }
)

// TTL index (auto-delete old documents)
db.logs.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 2592000 }  // 30 days
)
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

## Server Metrics to Monitor

```javascript
// Key metrics from serverStatus
db.serverStatus().opcounters     // CRUD operation counts
db.serverStatus().connections    // Current connections
db.serverStatus().mem            // Memory usage
db.serverStatus().globalLock     // Lock contention

// WiredTiger cache metrics
db.serverStatus().wiredTiger.cache
// Look for:
// - "bytes currently in the cache" vs available RAM
// - "pages evicted by application threads" (high = pressure)
```

## Aggregation Pipeline Optimization

### Stage Ordering
```javascript
// GOOD: Filter early
db.orders.aggregate([
  { $match: { status: "shipped", date: { $gte: startDate } } },
  { $group: { _id: "$customerId", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } },
  { $limit: 10 }
])

// BAD: Sort before filtering
db.orders.aggregate([
  { $sort: { date: -1 } },
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

## Output Guidelines

- Keep answers short and clear: a few sentences on index and optimization suggestions
- Focus on highest impact indexes or optimizations
- Do not use strong language like "this will definitely improve performance"
- Explain they are suggestions and give the reasoning behind them
- Consider how many indexes already exist on the collection (shouldn't generally be more than 20)
- Suggest removing indexes only if they are clearly unused (check `$indexStats`)
- Never create indexes without user approval - show the command and wait for confirmation
