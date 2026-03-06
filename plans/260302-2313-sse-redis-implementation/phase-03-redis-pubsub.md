# Phase 3: Redis Pub/Sub for Readings + Alerts

**Priority:** High | **Effort:** Medium | **Status:** Complete

## Overview

After reading ingestion and alert creation, publish events to Redis channels. SSE endpoint (Phase 4) will subscribe and push to browsers.

## Channels

| Channel | Payload | Publisher |
|---------|---------|-----------|
| `readings:latest` | `CameraReading[]` (latest per camera) | `reading-service.ingestReadings()` |
| `alerts:new` | `Alert` object | `alert-evaluation-service` (after createAlert) |

## Implementation Steps

### 1. Create pub/sub helper

**File:** `src/lib/redis-pubsub.ts`

```typescript
import { redisPub } from "@/lib/redis";

export async function publishReadings(readings: CameraReading[]) {
  await redisPub.publish("readings:latest", JSON.stringify(readings));
}

export async function publishAlert(alert: Alert) {
  await redisPub.publish("alerts:new", JSON.stringify(alert));
}
```

### 2. Publish after reading ingestion

**File:** `src/services/reading-service.ts`

After `ingestReadings()` completes bulk insert + alert evaluation:

```typescript
// After existing logic...
// Fetch fresh latest readings for all cameras
const latest = await getLatestReadings();
publishReadings(latest); // fire-and-forget, no await needed
```

Non-blocking: publish errors logged but don't fail ingestion.

### 3. Publish after alert creation

**File:** `src/services/alert-evaluation-service.ts`

In the `createAlert` helper or after `prisma.alert.create()`:

```typescript
publishAlert(alert); // fire-and-forget
```

### 4. Threshold invalidation via pub/sub

When thresholds are created/updated/deleted via API, publish invalidation event so other instances refresh:

```typescript
// In threshold API routes, after mutation:
await thresholdCache.invalidate();
redisPub.publish("thresholds:invalidate", "1");
```

SSE endpoint or a startup listener can subscribe to `thresholds:invalidate` and call `thresholdCache.invalidate()` locally.

## Files to Create

- `src/lib/redis-pubsub.ts`

## Files to Modify

- `src/services/reading-service.ts` — publish after ingest
- `src/services/alert-evaluation-service.ts` — publish after alert creation

## Success Criteria

- `redis-cli SUBSCRIBE readings:latest` shows JSON payloads on each ingestion
- `redis-cli SUBSCRIBE alerts:new` shows alert objects on threshold breach
