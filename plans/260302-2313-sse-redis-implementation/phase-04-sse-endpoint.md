# Phase 4: SSE API Endpoint

**Priority:** High | **Effort:** Medium | **Status:** Complete

## Overview

Create a single SSE endpoint that streams readings and alerts to connected browsers via Redis pub/sub subscription.

## Implementation Steps

### 1. Create SSE route

**File:** `src/app/api/sse/route.ts`

```typescript
import { redisSub } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Create dedicated subscriber for this connection
      const sub = redisSub.duplicate();

      function send(event: string, data: string) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      }

      // Send heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 30_000);

      sub.subscribe("readings:latest", "alerts:new");

      sub.on("message", (channel, message) => {
        if (channel === "readings:latest") {
          send("readings", message);
        } else if (channel === "alerts:new") {
          send("alert", message);
        }
      });

      // Cleanup on client disconnect
      const cleanup = () => {
        clearInterval(heartbeat);
        sub.unsubscribe();
        sub.disconnect();
      };

      // ReadableStream cancel callback
      stream.cancel = () => { cleanup(); };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
```

### 2. SSE event format

```
event: readings
data: [{"cameraId":"cam-001","celsius":42.5,...},...]

event: alert
data: {"id":"alert-1","cameraId":"cam-001","type":"TEMPERATURE",...}
```

### 3. Handle connection lifecycle

- Each browser connection creates a dedicated Redis subscriber (via `duplicate()`)
- On disconnect: unsubscribe + disconnect Redis client
- Heartbeat prevents proxy/load-balancer timeout
- `force-dynamic` prevents Next.js caching the route

### 4. Initial data on connect

Send current state immediately so client doesn't wait for next publish:

```typescript
// In start(), before subscribing:
const latestReadings = await getLatestReadings();
send("readings", JSON.stringify(latestReadings));
```

## Files to Create

- `src/app/api/sse/route.ts`

## Success Criteria

- `curl -N http://localhost:3000/api/sse` shows SSE event stream
- Events appear within 1s of reading ingestion
- Connection auto-cleaned on client disconnect
- Heartbeat visible every 30s
