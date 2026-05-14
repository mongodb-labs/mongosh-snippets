---
name: mongodb-search-and-ai
description: Guide users through implementing and optimizing Atlas Search (full-text), Vector Search (semantic), and Hybrid Search solutions. Use this skill when users need to build search functionality for text-based queries (autocomplete, fuzzy matching, faceted search), semantic similarity (embeddings, RAG applications), or combined approaches. Also use when users need text containment, substring matching ('contains', 'includes', 'appears in'), case-insensitive or multi-field text search, or filtering across many fields with variable combinations.
disable-model-invocation: false
---

# MongoDB Search and AI

You are helping MongoDB users implement, optimize, and troubleshoot Atlas Search (lexical), Vector Search (semantic), and Hybrid Search (combined) solutions.

**Important:** Atlas Search and Vector Search require MongoDB Atlas (cloud) and cannot be used with self-hosted MongoDB instances. These features use specialized Lucene-based indexes that are separate from regular MongoDB indexes.

## Core Principles

1. **Understand before building** - Validate the use case to ensure you recommend the right solution
2. **Always inspect first** - Check existing indexes and schema before making recommendations
3. **Explain before executing** - Describe what indexes will be created and require explicit approval
4. **Optimize for the use case** - Different use cases require different index configurations and query patterns

## Workflow

### 1. Discovery Phase

**Check the environment using mongosh_eval:**
- Use `db.getMongo().connectionInfo` to check if connected to Atlas
- Use `db.serverBuildInfo()` to check MongoDB version
- Use `show collections` and `db.collection.stats()` to understand data

```javascript
// Check if running on Atlas
db.adminCommand({ atlasVersion: 1 })

// List collections
db.getCollectionNames()

// Inspect collection structure
db.collection.find().limit(3)
```

**Understand the use case:**
If the user's request is vague, ask clarifying questions:
- What are users searching for? (products, movies, documents, etc.)
- What fields contain the searchable content?
- Do they need exact matching, fuzzy matching, or semantic similarity?
- Do they need filters (price ranges, categories, dates)?
- Do they need autocomplete/typeahead functionality?

### 2. Determine Search Type

**Atlas Search (Lexical/Full-Text):**
Use when users need:
- Keyword matching with relevance scoring
- Fuzzy matching for typo tolerance
- Autocomplete/typeahead
- Faceted search with filters
- Language-specific text analysis
- Token-based search

**Vector Search (Semantic):**
Use when users need:
- Semantic similarity ("find movies about coming of age stories")
- Natural language understanding
- RAG (Retrieval Augmented Generation) applications
- Finding conceptually similar items
- Cross-modal search

**Hybrid Search:**
Use when users need:
- Combining multiple search approaches (e.g., vector + lexical)
- Queries like "find action movies similar to 'epic space battles'" (combining keyword filtering with semantic similarity)
- Results that factor in multiple relevance criteria

### 3. Version Check

If using Hybrid Search with `$rankFusion` or `$scoreFusion`, verify the cluster version:
- `$rankFusion` requires MongoDB 8.0+
- `$scoreFusion` requires MongoDB 8.2+

```javascript
// Check version
db.version()
// or
db.serverBuildInfo().version
```

## Atlas Search (Lexical Search)

### Creating Search Indexes

Atlas Search indexes are created through the Atlas UI or API, not through mongosh directly. However, you can use mongosh to query them once created.

**Index Configuration Examples:**

```javascript
// Basic text index (via Atlas UI/API)
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "title": { "type": "string", "analyzer": "standard" },
      "description": { "type": "string", "analyzer": "standard" },
      "category": { "type": "stringFacet" }
    }
  }
}

// Autocomplete index
{
  "mappings": {
    "fields": {
      "title": {
        "type": "autocomplete",
        "tokenization": "edgeGram",
        "minGrams": 2,
        "maxGrams": 10
      }
    }
  }
}
```

### Querying with $search

Once the index is created via Atlas, query using mongosh:

```javascript
// Basic text search
db.collection.aggregate([
  {
    $search: {
      index: "default",
      text: {
        query: "mongodb performance",
        path: ["title", "description"]
      }
    }
  },
  { $limit: 10 }
])

// Search with fuzzy matching
db.collection.aggregate([
  {
    $search: {
      index: "default",
      text: {
        query: "databse",
        path: "title",
        fuzzy: { maxEdits: 1, prefixLength: 3 }
      }
    }
  }
])

// Autocomplete
db.collection.aggregate([
  {
    $search: {
      index: "autocomplete_index",
      autocomplete: {
        query: "mong",
        path: "title",
        tokenOrder: "sequential"
      }
    }
  },
  { $limit: 5 }
])

// Faceted search with filters
db.collection.aggregate([
  {
    $search: {
      index: "default",
      compound: {
        must: [{ text: { query: "laptop", path: "title" } }],
        filter: [{ range: { path: "price", gt: 500, lt: 2000 } }]
      }
    }
  },
  {
    $facet: {
      results: [{ $limit: 10 }],
      categories: [
        { $unwind: "$category" },
        { $sortByCount: "$category" }
      ]
    }
  }
])
```

## Vector Search

### Creating Vector Search Indexes

Vector Search indexes are also created through Atlas UI/API:

```javascript
// Vector index configuration (via Atlas UI/API)
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "euclidean"
    }
  ]
}
```

### Querying with $vectorSearch

```javascript
// Semantic similarity search
db.collection.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: [0.1, 0.2, 0.3, /* ... 1536 dimensions */],
      numCandidates: 100,
      limit: 10
    }
  }
])

// Vector search with pre-filter
db.collection.aggregate([
  {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector: embedding,
      numCandidates: 100,
      limit: 10,
      filter: { category: "electronics" }
    }
  }
])
```

## Hybrid Search

Combining multiple search approaches using rank/score fusion:

```javascript
// $rankFusion (MongoDB 8.0+)
db.collection.aggregate([
  {
    $rankFusion: {
      input: {
        pipelines: {
          textSearch: [
            {
              $search: {
                index: "text_index",
                text: { query: "action movie", path: "title" }
              }
            }
          ],
          vectorSearch: [
            {
              $vectorSearch: {
                index: "vector_index",
                path: "embedding",
                queryVector: queryEmbedding,
                numCandidates: 100,
                limit: 50
              }
            }
          ]
        }
      }
    }
  }
])

// $scoreFusion (MongoDB 8.2+)
db.collection.aggregate([
  {
    $scoreFusion: {
      input: {
        pipelines: {
          keyword: [
            { $search: { index: "default", text: { query: "term", path: "title" } } }
          ],
          semantic: [
            { $vectorSearch: { index: "vector", path: "embedding", queryVector: vec, limit: 50 } }
          ]
        },
        normalization: "sigmoid",
        weights: { keyword: 0.3, semantic: 0.7 }
      }
    }
  }
])
```

## When NOT to Use Atlas Search

**For simple text containment**, regular MongoDB queries may be sufficient:

```javascript
// Simple substring match (case-sensitive)
db.collection.find({ title: /mongodb/i })

// Multi-field text search with $or
db.collection.find({
  $or: [
    { title: { $regex: "mongodb", $options: "i" } },
    { description: { $regex: "mongodb", $options: "i" } }
  ]
})
```

**When to use regular queries vs Atlas Search:**

| Feature | Regular Query | Atlas Search |
|---------|---------------|--------------|
| Simple substring | `$regex` | Overkill |
| Relevance scoring | No | Yes |
| Fuzzy matching | No | Yes |
| Autocomplete | Limited | Full support |
| Language analysis | No | Yes |
| Large text search | Slow | Optimized |

## Anti-Patterns to Avoid

**NEVER recommend $regex for production search:**
- `$regex` is not designed for full-text search
- Lacks relevance scoring, fuzzy matching, and language-aware tokenization
- Poor performance on large collections

If a user asks for regex/text for a search use case, explain why Atlas Search is more appropriate.

## Implementation Workflow

1. **Verify Atlas**: Confirm user is on MongoDB Atlas
2. **Analyze schema**: Check fields that will be indexed
3. **Recommend index**: Provide JSON configuration for Atlas UI
4. **Wait for approval**: User creates index via Atlas
5. **Build queries**: Construct $search/$vectorSearch aggregations
6. **Test and refine**: Iterate on query parameters

## Action Policy

**I will NEVER execute write operations without your explicit approval.**

Search index creation and management:
1. I'll explain **what** index I recommend and **why**
2. I'll provide the **exact JSON configuration** for Atlas UI/API
3. I'll **wait for your approval** before suggesting index creation
4. I'll help you construct and test queries once indexes exist

**Note:** Atlas Search indexes cannot be created via mongosh - they require the Atlas UI or Admin API.
