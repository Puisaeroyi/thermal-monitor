# Phase 2: Redis Threshold Cache

**Priority:** High | **Effort:** Medium | **Status:** Complete

## Overview

Replace in-memory `ThresholdCache` class with Redis-backed cache. Same lazy-refresh pattern but data survives restarts and is shared across instances.

## Context

Current `src/services/threshold-cache.ts` uses in-memory arrays with 60s TTL. Replace with Redis keys using TTL expiry.

## Implementation Steps

### 1. Rewrite `src/services/threshold-cache.ts`

Replace class internals to use Redis:

```typescript
import { redis } from "@/lib/redis";

const TEMP_KEY = "thresholds:temp";
const GAP_KEY = "thresholds:gap";
const TTL_SECONDS = 60;

export const thresholdCache = {
  async getTemperatureThresholds() {
    const cached = await redis.get(TEMP_KEY);
    if (cached) return JSON.parse(cached);
    return this.refreshTemperature();
  },

  async getGapThresholds() {
    const cached = await redis.get(GAP_KEY);
    if (cached) return JSON.parse(cached);
    return this.refreshGap();
  },

  async refreshTemperature() {
    const data = await prisma.temperatureThreshold.findMany({ where: { enabled: true } });
    await redis.setex(TEMP_KEY, TTL_SECONDS, JSON.stringify(data));
    return data;
  },

  async refreshGap() {
    const data = await prisma.gapThreshold.findMany({ where: { enabled: true } });
    await redis.setex(GAP_KEY, TTL_SECONDS, JSON.stringify(data));
    return data;
  },

  async invalidate() {
    await redis.del(TEMP_KEY, GAP_KEY);
  },
};
```

### 2. Replace cooldown manager with Redis TTL keys

**File:** `src/services/cooldown-manager.ts`

Replace in-memory Map with Redis keys that auto-expire:

```typescript
import { redis } from "@/lib/redis";

export const cooldownManager = {
  async canAlert(thresholdId: string, cameraId: string): Promise<boolean> {
    const key = `cooldown:${thresholdId}:${cameraId}`;
    const exists = await redis.exists(key);
    return !exists;
  },

  async recordAlert(thresholdId: string, cameraId: string, cooldownMinutes: number): void {
    const key = `cooldown:${thresholdId}:${cameraId}`;
    await redis.setex(key, cooldownMinutes * 60, "1");
  },
};
```

Benefits: Cooldowns survive server restart. No manual cleanup needed — Redis TTL handles expiry.

### 3. Update callers

`alert-evaluation-service.ts` calls `cooldownManager.canAlert()` and `cooldownManager.recordAlert()`. Update to pass `cooldownMinutes` to `recordAlert` (currently uses the threshold's value already, just ensure async/await since Redis ops are async).

Key change: `canAlert` and `recordAlert` are now `async` — add `await` at call sites.

### 4. Keep gap-ring-buffer in-memory

Gap ring buffer stays in-memory. It's write-heavy (every reading), short-lived (15min window), and per-process is fine since readings ingestion happens on one server. Moving to Redis would add latency for no benefit.

## Files to Modify

- `src/services/threshold-cache.ts` — Redis-backed cache
- `src/services/cooldown-manager.ts` — Redis TTL keys
- `src/services/alert-evaluation-service.ts` — Add await to cooldown calls

## Success Criteria

- Threshold cache reads/writes from Redis
- Cooldowns persist across server restart
- `redis-cli KEYS "thresholds:*"` shows cached keys
- `redis-cli KEYS "cooldown:*"` shows active cooldowns with TTL
