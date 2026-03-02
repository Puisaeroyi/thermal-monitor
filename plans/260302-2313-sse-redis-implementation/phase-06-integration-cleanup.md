# Phase 6: Integration + Cleanup

**Priority:** Medium | **Effort:** Small | **Status:** Complete

## Overview

Wire everything together, update docs, test end-to-end, update Docker/env configs.

## Implementation Steps

### 1. Update `docker-compose.yml` environment

Ensure `REDIS_URL` is set for app service and Redis is in depends_on.

### 2. Update README.md

- Add Redis to prerequisites
- Update Tech Stack table (add Redis)
- Replace "Polling Architecture" section with "SSE Architecture" section
- Update `docker compose` instructions

### 3. Update `docs/system-architecture.md`

- Replace polling flow diagram with SSE flow
- Add Redis to high-level architecture diagram
- Update caching strategy section (Redis replaces in-memory)
- Update scalability section (SSE replaces polling)

### 4. Update `docs/deployment-guide.md`

- Add Redis setup instructions
- Add `REDIS_URL` env var documentation

### 5. Graceful Redis unavailability

If Redis is down on startup:
- Threshold cache falls back to direct DB query (no cache)
- Cooldown manager falls back to in-memory Map
- SSE endpoint returns 503 — client falls back to polling
- Log warnings, don't crash

### 6. Remove dead code

- Remove `POLLING_INTERVAL_MS` constant if no longer used as primary
- Clean up unused imports in modified hooks

### 7. End-to-end verification checklist

- [ ] `docker compose up` starts postgres + redis + app
- [ ] Dashboard loads and shows live data via SSE
- [ ] POST readings → SSE pushes to dashboard in <1s
- [ ] Threshold breach → alert toast in <1s
- [ ] Kill Redis → dashboard falls back to polling gracefully
- [ ] Restart Redis → SSE auto-reconnects
- [ ] Threshold create/update → cache invalidated across connections

## Files to Modify

- `docker-compose.yml`
- `README.md`
- `docs/system-architecture.md`
- `docs/deployment-guide.md`
- `src/lib/constants.ts` (cleanup)

## Success Criteria

- Full system works with `docker compose up` (zero manual setup)
- SSE is primary transport, polling is automatic fallback
- Docs reflect new architecture
