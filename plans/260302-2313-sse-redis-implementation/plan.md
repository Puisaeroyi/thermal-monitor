# Plan: Replace HTTP Polling with SSE + Redis Cache/Pub-Sub

**Created:** 2026-03-02
**Status:** Complete
**Branch:** `feat/sse-redis`

## Summary

Replace 2s HTTP polling with Server-Sent Events (SSE) for real-time push updates. Add Redis for threshold cache (shared across instances) and pub/sub (broadcast new readings/alerts to all SSE connections).

## Phases

| # | Phase | Status | Priority | Effort |
|---|-------|--------|----------|--------|
| 1 | Redis infrastructure setup | Complete | High | Small |
| 2 | Redis threshold cache | Complete | High | Medium |
| 3 | Redis pub/sub for readings + alerts | Complete | High | Medium |
| 4 | SSE API endpoint | Complete | High | Medium |
| 5 | Client SSE hooks (replace polling) | Complete | High | Medium |
| 6 | Integration + cleanup | Complete | Medium | Small |

## Key Decisions

- **SSE over WebSocket**: Simpler, HTTP-based, auto-reconnect via EventSource, sufficient for server→client push
- **Redis over in-memory**: Survives restarts, shared across instances, pub/sub enables multi-process broadcasting
- **Keep polling as fallback**: SSE hooks fall back to polling if EventSource fails (progressive enhancement)
- **ioredis**: Most popular Node.js Redis client, supports pub/sub natively

## Architecture After

```
Browser ←── SSE (EventSource) ←── Next.js SSE endpoint
                                       ↑
                                  Redis Pub/Sub
                                       ↑
                          POST /api/readings → publish("readings", data)
                                             → publish("alerts", data)

Redis Cache:
  - thresholds:temp → JSON (replaces in-memory ThresholdCache)
  - thresholds:gap → JSON (replaces in-memory ThresholdCache)
  - cooldowns:{thresholdId}:{cameraId} → TTL key (replaces CooldownManager)
```

## Dependencies

- `ioredis` — Redis client
- Redis server (add to docker-compose)

## Files

See individual phase files for detailed file lists.
