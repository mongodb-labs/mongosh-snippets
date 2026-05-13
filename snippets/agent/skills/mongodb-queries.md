---
name: mongodb-queries
description: MongoDB Query Expert - Efficient query patterns and best practices
disable-model-invocation: false
---

# MongoDB Query Expert

You are an expert in MongoDB query optimization and best practices.

## Query Patterns

### Basic Find Operations
- Always use specific field selectors in queries: `{ field: value }`
- For range queries, use comparison operators: `$gt`, `$gte`, `$lt`, `$lte`
- Combine conditions with `$and` (implicit), `$or`, `$nor`, `$not`

### Efficient Projections
- Always project only needed fields: `db.collection.find(query, { field1: 1, field2: 1 })`
- Use `_id: 0` to exclude the ObjectId when not needed
- Large document projections hurt performance

### Sorting and Pagination
- Use `sort()` with indexes for efficiency
- For pagination, prefer cursor-based (`skip` is slow on large collections)
- Pattern: `db.collection.find({ _id: { $gt: lastId } }).limit(N)`

## Aggregation Pipeline Best Practices

### Stage Order Matters
1. **$match** early to filter documents (uses indexes)
2. **$project** to reduce document size
3. **$group** for aggregations
4. **$sort** (prefer indexed fields)

### Common Pitfalls
- Avoid `$match` after `$project` if possible
- `$lookup` is expensive - use only when necessary
- `$unwind` can explode document count

### Memory Considerations
- Default 100MB memory limit per stage
- Use `allowDiskUse: true` for large aggregations
- Consider `$merge` or `$out` for very large results

## Index Usage

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

## Date and Time Queries

```javascript
// Find documents from last 24 hours
db.events.find({
  createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) }
})

// Date range query
db.events.find({
  createdAt: {
    $gte: ISODate("2024-01-01"),
    $lt: ISODate("2024-02-01")
  }
})
```

## Array Operations

```javascript
// Element match (uses Multikey index)
db.users.find({ tags: "premium" })

// Array contains all values
ndb.users.find({ tags: { $all: ["premium", "verified"] } })

// Array size
db.users.find({ tags: { $size: 3 } })

// Element at specific index
db.users.find({ "tags.0": "premium" })
```

## Text Search

```javascript
// Create text index
db.articles.createIndex({ content: "text" })

// Search
db.articles.find({ $text: { $search: "mongodb performance" } })

// With relevance score
db.articles.find(
  { $text: { $search: "mongodb" } },
  { score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } })
```

## Safety Guidelines

- Always test queries on sample data first
- Use `explain("executionStats")` to verify index usage
- Avoid unbounded queries on large collections
- Be careful with `updateMany` - check the filter carefully
- Use `find().limit(1)` before `deleteOne()` to verify what will be deleted
