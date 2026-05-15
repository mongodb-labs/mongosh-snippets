---
name: mongodb-connection
description: Optimize MongoDB client connection configuration (pools, timeouts, patterns) for any supported driver language. Use this skill when working/updating/reviewing functions that instantiate or configure a MongoDB client (eg, when calling `connect()`), configuring connection pools, troubleshooting connection errors (ECONNREFUSED, timeouts, pool exhaustion), optimizing performance issues related to connections.
disable-model-invocation: false
---

# MongoDB Connection Optimizer

You are an expert in MongoDB connection management across all officially supported driver languages (Node.js, Python, Java, Go, C#, Ruby, PHP, etc.).

**Note:** This skill is for application/driver connection configuration, not for the current mongosh session. For the current mongosh connection, use `db.getMongo()` to inspect connection state.

## Core Principle: Context Before Configuration

**NEVER add connection pool parameters or timeout settings without first understanding the application's context.** Arbitrary values without justification lead to performance issues and harder-to-debug problems.

## Understanding Connection Pools

- Connection pooling exists because establishing a MongoDB connection is expensive (TCP + TLS + auth = 50-500ms)
- Open connections consume ~1 MB of RAM on the MongoDB server per connection
- Each MongoClient establishes 2 monitoring connections per replica set member

**Connection Lifecycle:** Borrow from pool → Execute operation → Return to pool → Prune idle connections exceeding `maxIdleTimeMS`.

**Formula:** `Total Connections = (minPoolSize + 2) × replica members × app instances`

Example: 10 instances, minPoolSize 5, 3-member set = 210 server connections.

## Configuration Design

**Before suggesting any configuration changes**, gather context about the application environment:

- Deployment type (serverless vs traditional server)
- Workload type (OLTP vs OLAP)
- Concurrency patterns (steady vs bursty)
- Server version and driver version
- Memory limits on application and database servers

### Configuration Scenarios

#### Scenario: Serverless Environments (Lambda, Cloud Functions)

**Critical pattern**: Initialize client OUTSIDE handler/function scope to enable connection reuse across warm invocations.

**Recommended configuration**:

| Parameter | Value | Reasoning |
|-----------|-------|-----------|
| `maxPoolSize` | 3-5 | Each serverless function instance has its own pool |
| `minPoolSize` | 0 | Prevent maintaining unused connections |
| `maxIdleTimeMS` | 10000-30000 | Release unused connections quickly (10-30s) |
| `connectTimeoutMS` | 5000 | Fail fast on connection issues |
| `socketTimeoutMS` | 5000 | Use timeouts to ensure sockets are closed |

**Node.js Example:**
```javascript
// OUTSIDE handler (reused across invocations)
const client = new MongoClient(uri, {
  maxPoolSize: 3,
  minPoolSize: 0,
  maxIdleTimeMS: 10000,
  connectTimeoutMS: 5000,
  socketTimeoutMS: 5000
});

export const handler = async (event) => {
  // Reuse existing connection
  const db = client.db("mydb");
  const result = await db.collection("items").find({});
  return result;
};
```

#### Scenario: Traditional Long-Running Servers (OLTP Workload)

**Recommended configuration**:

| Parameter | Value | Reasoning |
|-----------|-------|-----------|
| `maxPoolSize` | 50-100 | Based on peak concurrent requests |
| `minPoolSize` | 10-20 | Pre-warmed connections for traffic spikes |
| `maxIdleTimeMS` | 300000-600000 | 5-10 minutes for stable servers |
| `connectTimeoutMS` | 5000-10000 | Fail fast on connection issues |
| `socketTimeoutMS` | 30000 | Prevent hanging queries |
| `serverSelectionTimeoutMS` | 5000 | Quick failover for replica set changes |

**Node.js Example:**
```javascript
const client = new MongoClient(uri, {
  maxPoolSize: 50,
  minPoolSize: 10,
  maxIdleTimeMS: 300000,
  connectTimeoutMS: 5000,
  socketTimeoutMS: 30000,
  serverSelectionTimeoutMS: 5000
});
```

#### Scenario: OLAP / Analytical Workloads

**Recommended configuration**:

| Parameter | Value | Reasoning |
|-----------|-------|-----------|
| `maxPoolSize` | 10-20 | Fewer concurrent operations |
| `minPoolSize` | 0-5 | Queries are infrequent |
| `socketTimeoutMS` | 300000+ | Allow long-running queries |
| `maxIdleTimeMS` | 600000 | Minimize connection churn |

**Node.js Example:**
```javascript
const client = new MongoClient(uri, {
  maxPoolSize: 15,
  minPoolSize: 2,
  socketTimeoutMS: 300000, // 5 minutes for slow queries
  maxIdleTimeMS: 600000
});
```

#### Scenario: High-Traffic / Bursty Workloads

**Recommended configuration**:

| Parameter | Value | Reasoning |
|-----------|-------|-----------|
| `maxPoolSize` | 100+ | Higher ceiling for traffic spikes |
| `minPoolSize` | 20-30 | More pre-warmed connections |
| `maxConnecting` | 2 | Prevent thundering herd |
| `waitQueueTimeoutMS` | 2000-5000 | Fail fast when pool exhausted |
| `maxIdleTimeMS` | 300000 | Balance reuse and cleanup |

## Troubleshooting Connection Issues

### Pool Exhaustion

**Symptoms:** `MongoWaitQueueTimeoutError`, increased latency, operations waiting.

**Diagnosis via mongosh (server-side):**
```javascript
// Check current connections
db.serverStatus().connections

// Check active operations
db.currentOp({ active: true })
```

**Solutions:**
- **Increase `maxPoolSize`** when: Server shows low utilization but clients are waiting
- **Don't increase** when: Server is at capacity (suggest query optimization instead)

### Connection Timeouts

**Symptoms:** `ECONNREFUSED`, `SocketTimeoutError`

**Check:**
- Network connectivity: Can you connect via mongosh from the same host?
- Firewall/VPC settings
- DNS resolution for SRV connections
- TLS certificate validity

### Connection Churn

**Symptoms:** Rapidly increasing `connections.totalCreated` server metric

**Causes:**
- Not reusing clients (creating new MongoClient per request)
- Not caching in serverless
- `maxIdleTimeMS` too low

**Solution:** Ensure single MongoClient instance reused across application lifecycle

## Monitoring Connections

```javascript
// In mongosh - check server-side connection metrics
db.serverStatus().connections
// Returns:
// {
//   current: 42,      // Current open connections
//   available: 838858, // Available connection slots
//   totalCreated: 1523 // Total connections created since startup
// }

// Check active operations
db.currentOp({ active: true }).inprog.length

// Check slow operations (if profiling enabled)
db.system.profile.find().sort({ ts: -1 }).limit(5)
```

## Best Practices Summary

1. **Create client once, reuse everywhere** - Never create new MongoClient per request
2. **Initialize outside serverless handlers** - Enable warm-start connection reuse
3. **Size pools based on concurrency** - Monitor and adjust based on actual load
4. **Use appropriate timeouts** - Match socketTimeoutMS to expected query duration
5. **Don't manually close connections** - Let the driver manage connection lifecycle
6. **Monitor connection metrics** - Watch `connections.current` and creation rate

## Action Policy

**I will NEVER suggest configuration changes without understanding your context first.**

Before recommending connection settings:
1. I'll ask about your deployment type and workload
2. I'll inquire about current issues you're experiencing
3. I'll suggest specific values **with explanations** of why they fit your scenario
4. You can then apply the configuration and test
