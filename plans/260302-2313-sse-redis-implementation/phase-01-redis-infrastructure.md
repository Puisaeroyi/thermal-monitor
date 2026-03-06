# Phase 1: Redis Infrastructure Setup

**Priority:** High | **Effort:** Small | **Status:** Complete

## Overview

Add Redis server to Docker Compose, install `ioredis`, create shared Redis client singleton.

## Implementation Steps

### 1. Add Redis to `docker-compose.yml`

Add `redis` service:

```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redisdata:/var/lib/redis/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s
    timeout: 3s
    retries: 5
```

Add `redisdata` to volumes. Add `redis` to `app.depends_on`.

Add env var to app service: `REDIS_URL: "redis://redis:6379"`

### 2. Install ioredis

```bash
npm install ioredis
```

### 3. Create Redis client singleton

**File:** `src/lib/redis.ts`

```typescript
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Main client for get/set operations
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// Dedicated subscriber client (pub/sub requires separate connection)
export const redisSub = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// Dedicated publisher client
export const redisPub = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});
```

### 4. Add `REDIS_URL` to `.env.local` template

```
REDIS_URL="redis://localhost:6379"
```

## Files to Create

- `src/lib/redis.ts`

## Files to Modify

- `docker-compose.yml`
- `package.json` (via npm install)

## Success Criteria

- `docker compose up` starts Redis alongside PostgreSQL
- `redis.ping()` returns "PONG" from Next.js server
