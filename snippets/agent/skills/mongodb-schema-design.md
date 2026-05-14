---
name: mongodb-schema-design
description: MongoDB schema design patterns and anti-patterns. Use when designing data models, reviewing schemas, migrating from SQL, or troubleshooting performance issues caused by schema problems. Triggers on "design schema", "embed vs reference", "MongoDB data model", "schema review", "unbounded arrays", "one-to-many", "tree structure", "16MB limit", "schema validation", "JSON Schema", "time series", "schema migration", "polymorphic", "TTL", "data lifecycle", "archive", "index explosion", "unnecessary indexes", "approximation pattern", "document versioning".
disable-model-invocation: false
---

# MongoDB Schema Design

Data modeling patterns and anti-patterns for MongoDB. Bad schema is the root cause of most MongoDB performance and cost issues—queries and indexes cannot fix a fundamentally wrong model.

## When to Apply

Reference these guidelines when:
- Designing a new MongoDB schema from scratch
- Migrating from SQL/relational databases to MongoDB
- Reviewing existing data models for performance issues
- Troubleshooting slow queries or growing document sizes
- Deciding between embedding and referencing
- Modeling relationships (one-to-one, one-to-many, many-to-many)
- Implementing tree/hierarchical structures
- Hitting the 16MB document limit
- Adding schema validation to existing collections

## Key Principle

> **"Data that is accessed together should be stored together."**

This is MongoDB's core philosophy. Embedding related data eliminates joins, reduces round trips, and enables atomic updates. Reference only when you must.

## Schema Anti-Patterns

### 1. Unnecessary Collections

**Problem:** Splitting homogeneous data into multiple collections by type, date, or tenant.

**Why it's bad:**
- More complex application logic
- Harder to query across collections
- Schema changes must be applied to multiple places

**Better approach:**
- Use a single collection with discriminator fields
- Use time-series collections for time-based data
- Use sharding for tenant isolation if needed

```javascript
// BAD: Separate collections per year
db.orders_2023, db.orders_2024

// GOOD: Single collection with date field
db.orders.createIndex({ createdAt: 1 })

// Query with date range
db.orders.find({
  createdAt: {
    $gte: ISODate("2024-01-01"),
    $lt: ISODate("2025-01-01")
  }
})
```

### 2. Excessive Lookups

**Problem:** Overly normalized collections that reference each other, requiring frequent `$lookup` operations.

**Why it's bad:**
- `$lookup` is expensive (distributed joins across shards)
- Increases query complexity and latency
- Defeats the purpose of document model

**Better approach:**
- Embed data that is accessed together
- Use extended reference pattern to cache frequently accessed fields

```javascript
// BAD: Normalized like SQL
db.orders.find().forEach(order => {
  const customer = db.customers.findOne({ _id: order.customerId });
  // Combine data in application
})

// GOOD: Embedded customer info
db.orders.find().forEach(order => {
  // customer name and email already embedded
  print(order.customer.name);
})

// Extended reference pattern (balance)
db.orders.find().forEach(order => {
  // Essential customer info embedded
  print(order.customer.name);
  // Full customer data fetched only when needed
  if (needFullProfile) {
    const customer = db.customers.findOne({ _id: order.customerId });
  }
})
```

### 3. Unnecessary Indexes

**Problem:** Creating indexes that overlap or are never used by queries.

**Why it's bad:**
- Slows down writes (each index must be updated)
- Consumes RAM and storage
- Can cause write performance issues

**Verification via mongosh_eval:**
```javascript
// Check index usage
db.collection.aggregate([{ $indexStats: {} }])

// Check for overlapping indexes
// If you have {a:1,b:1}, you don't need {a:1}
```

**Better approach:**
- Drop unused indexes (but verify first)
- Design compound indexes to cover multiple queries
- Use partial indexes for specific query patterns

```javascript
// Remove unused index (after verifying with $indexStats)
db.collection.dropIndex("unused_index_name")
```

## Schema Fundamentals

### Embed vs Reference Decision Framework

| Relationship | Cardinality | Access Pattern | Recommendation |
|-------------|-------------|----------------|----------------|
| One-to-One | 1:1 | Always together | **Embed** |
| One-to-Few | 1:N (N < 100) | Usually together | **Embed array** |
| One-to-Many | 1:N (N > 100) | Often separate | **Reference** |
| Many-to-Many | M:N | Varies | **Two-way reference** |

This is a **rough** guideline. Always verify with your actual workload.

**Embed when:**
- Data is always accessed together (1:1, 1:few)
- Atomic updates are needed across the data
- Arrays are bounded and small

**Reference when:**
- Data is accessed independently
- Relationships are many-to-many
- Arrays can grow without bound

```javascript
// Embed: User with few addresses
db.users.insertOne({
  name: "John",
  addresses: [
    { street: "123 Main St", city: "NYC", primary: true },
    { street: "456 Oak Ave", city: "LA", primary: false }
  ]
})

// Reference: User with many (unbounded) orders
db.users.insertOne({
  name: "John",
  // Don't embed orders here - they can be thousands
})
// Store orders in separate collection with userId reference
db.orders.insertOne({
  userId: user._id,
  items: [...],
  total: 100.00
})
```

### Document Size Management

**The 16MB limit is hard.** Common causes:
- Unbounded arrays
- Large embedded binaries
- Deeply nested objects

**Verification via mongosh_eval:**
```javascript
// Check document sizes in collection
db.collection.aggregate([
  { $project: { size: { $bsonSize: "$$ROOT" } } },
  { $sort: { size: -1 } },
  { $limit: 10 }
])

// Check for large arrays
db.collection.find({
  $expr: { $gt: [{ $size: "$arrayField" }, 100] }
})
```

**Mitigation strategies:**
- Move unbounded data to separate collections
- Use bucketing pattern for time-series data
- Use referencing for large subdocuments

### Schema Validation

Use MongoDB's built-in `$jsonSchema` validator to catch invalid data at the database level.

```javascript
// Add validation to existing collection
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email"],
      properties: {
        name: {
          bsonType: "string",
          description: "must be a string and is required"
        },
        email: {
          bsonType: "string",
          pattern: "^.+@.+$",
          description: "must be a valid email"
        },
        age: {
          bsonType: "int",
          minimum: 0,
          maximum: 150
        }
      }
    }
  },
  validationLevel: "moderate",  // Allow existing docs, validate new/modified
  validationAction: "warn"        // Log violations without rejecting
})

// Later tighten to strict/error
```

## Design Patterns

### 1. Approximation Pattern

Use approximate values for high-frequency counters instead of exact counts.

```javascript
// Instead of incrementing on every view (expensive)
db.articles.updateOne(
  { _id: articleId },
  { $inc: { views: 1 } }
)

// Use approximation with random increment
db.articles.updateOne(
  { _id: articleId },
  { $inc: { views: Math.floor(Math.random() * 10) + 1 } }
)
```

### 2. Bucket Pattern

Group time-series or IoT data into buckets to reduce document count and improve query efficiency.

```javascript
// Bucket by hour
db.sensorData.insertOne({
  sensorId: "sensor123",
  date: ISODate("2024-01-01"),
  hour: 14,
  measurements: [
    { minute: 0, value: 23.5 },
    { minute: 1, value: 23.6 },
    // ... up to 60 minutes
  ],
  avgValue: 23.55,
  minValue: 23.1,
  maxValue: 24.2
})
```

### 3. Computed Pattern

Pre-calculate expensive aggregations and store them.

```javascript
// Store computed totals with order
db.orders.insertOne({
  items: [
    { product: "A", qty: 2, price: 10 },
    { product: "B", qty: 1, price: 20 }
  ],
  computed: {
    subtotal: 40,
    tax: 4,
    total: 44
  }
})
```

### 4. Extended Reference Pattern

Cache frequently-accessed data from related entities.

```javascript
// Order embeds essential customer info
db.orders.insertOne({
  customer: {
    _id: customerId,
    name: "John Doe",
    email: "john@example.com"  // Frequently needed
  },
  customerId: customerId  // Reference for full profile if needed
  // ... order details
})
```

### 5. Outlier Pattern

Handle collections where a small subset of documents are much larger.

```javascript
// Most products have few reviews
db.products.insertOne({
  name: "Widget",
  reviews: [review1, review2]  // Embedded for most
})

// Popular product with thousands of reviews
db.products.insertOne({
  name: "iPhone",
  reviewCount: 50000,
  recentReviews: [review1, review2, review3],  // Last 3 only
  allReviewsReference: "reviews_iphone"  // Points to separate collection
})
```

### 6. Polymorphic Pattern

Store different types of entities in the same collection.

```javascript
// Different product types in same collection
db.products.insertMany([
  {
    type: "electronics",
    name: "Laptop",
    specs: { cpu: "i7", ram: "16GB" }
  },
  {
    type: "clothing",
    name: "T-Shirt",
    specs: { size: "M", color: "blue" }
  }
])

// Query by type
db.products.find({ type: "electronics" })
```

### 7. Schema Versioning

Handle schema evolution gracefully.

```javascript
// Documents include schema version
db.users.insertOne({
  schemaVersion: 2,
  name: "John",
  email: "john@example.com",
  // New field added in v2
  preferences: { theme: "dark" }
})

// Application handles migration
if (doc.schemaVersion === 1) {
  // Migrate to v2
  doc.preferences = { theme: "light" };
  doc.schemaVersion = 2;
}
```

### 8. Document Versioning

Track document changes for audit trails.

```javascript
db.articles.insertOne({
  title: "My Article",
  content: "Current content",
  version: 5,
  history: [
    { version: 1, content: "Original", modifiedAt: ISODate(...) },
    { version: 2, content: "First edit", modifiedAt: ISODate(...) },
    // ... keep last N versions
  ]
})
```

### 9. Archive Pattern

Move historical data to separate/cold storage.

```javascript
// Active orders in hot collection
db.orders.insertOne({
  _id: orderId,
  status: "pending",
  createdAt: ISODate("2024-01-01")
})

// Archive completed old orders (via scheduled job)
db.orders.find({
  status: "completed",
  createdAt: { $lt: ISODate("2023-01-01") }
}).forEach(doc => {
  db.ordersArchive.insertOne(doc);
  db.orders.deleteOne({ _id: doc._id });
})
```

## Verification Commands

Use these mongosh_eval commands to analyze your schema:

```javascript
// Check document sizes
db.collection.aggregate([
  { $project: { size: { $bsonSize: "$$ROOT" } } },
  { $group: { _id: null, avgSize: { $avg: "$size" }, maxSize: { $max: "$size" } } }
])

// Find documents with large arrays
db.collection.find({
  $expr: { $gt: [{ $size: "$arrayField" }, 100] }
}).limit(5)

// Check for field consistency across documents
db.collection.aggregate([
  { $project: { fields: { $objectToArray: "$$ROOT" } } },
  { $unwind: "$fields" },
  { $group: { _id: "$fields.k", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])

// Collection stats
db.collection.stats()
```

## Action Policy

**I will NEVER execute write operations without your explicit approval.**

Before any schema change:
1. I'll explain **what** I want to do and **why**
2. I'll show you the **exact command**
3. I'll **wait for your approval** before executing
4. If you say "go ahead" or "yes", only then will I run it

**Your database, your decision.**
