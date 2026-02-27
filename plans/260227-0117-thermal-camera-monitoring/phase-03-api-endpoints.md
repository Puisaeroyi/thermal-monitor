---
phase: 3
title: "API Endpoints"
status: pending
priority: P1
effort: 5h
depends_on: [2]
---

# Phase 3 — API Endpoints

## Context Links
- [Plan Overview](./plan.md)
- [Phase 2 — Database Schema](./phase-02-database-schema.md)
- Next.js Route Handlers: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

## Overview
Implement all REST API endpoints: cameras CRUD, readings ingestion + query, threshold CRUD, alert queries, and the alert evaluation pipeline triggered on ingestion.

## Requirements

### Functional
- Cameras: full CRUD
- Readings: POST (single + batch), GET with filters (cameraId, timeRange, limit)
- Readings latest: GET latest reading per camera (for dashboard grid)
- Thresholds (temperature + gap): full CRUD
- Alerts: GET with filters, POST acknowledge
- Alert evaluation runs on every reading ingestion

### Non-Functional
- Batch ingestion: accept array of readings in single POST
- Query performance: readings endpoint must return <500ms for 30min window
- Input validation on all endpoints (reject malformed data early)
- Consistent error response format: `{ error: string, details?: any }`
- All services <200 lines each

## Architecture

### Service Layer Pattern
API routes are thin — they parse request, call service, return response. Business logic lives in `src/services/`.

```
API Route (parse + validate + respond)
  → Service (business logic)
    → Prisma (data access)
```

### Endpoint Map

| Method | Path | Service | Description |
|--------|------|---------|-------------|
| GET | `/api/cameras` | camera-service | List all cameras |
| POST | `/api/cameras` | camera-service | Create camera |
| GET | `/api/cameras/[cameraId]` | camera-service | Get single camera |
| PUT | `/api/cameras/[cameraId]` | camera-service | Update camera |
| DELETE | `/api/cameras/[cameraId]` | camera-service | Delete camera |
| POST | `/api/readings` | reading-service | Ingest reading(s) + trigger alerts |
| GET | `/api/readings` | reading-service | Query readings (cameraId, from, to, limit) |
| GET | `/api/readings/latest` | reading-service | Latest reading per camera |
| GET | `/api/thresholds/temperature` | threshold-service | List temp thresholds |
| POST | `/api/thresholds/temperature` | threshold-service | Create temp threshold |
| PUT | `/api/thresholds/temperature/[id]` | threshold-service | Update temp threshold |
| DELETE | `/api/thresholds/temperature/[id]` | threshold-service | Delete temp threshold |
| GET | `/api/thresholds/gap` | threshold-service | List gap thresholds |
| POST | `/api/thresholds/gap` | threshold-service | Create gap threshold |
| PUT | `/api/thresholds/gap/[id]` | threshold-service | Update gap threshold |
| DELETE | `/api/thresholds/gap/[id]` | threshold-service | Delete gap threshold |
| GET | `/api/alerts` | alert-service | List alerts (filters: cameraId, type, acknowledged, from, to) |
| POST | `/api/alerts/[id]/acknowledge` | alert-service | Acknowledge alert |
| GET | `/api/settings/email` | email-service | Get email config |
| PUT | `/api/settings/email` | email-service | Update email config |

### Alert Evaluation Flow (on reading ingestion)

```
POST /api/readings
  1. Validate input
  2. Insert reading(s) into DB
  3. For each reading:
     a. Check temperature thresholds (DB query for active thresholds matching camera)
     b. Update in-memory gap buffer
     c. Check gap thresholds against buffer
     d. If any breach → create alert record + trigger notification
  4. Return 201 with inserted count
```

### In-Memory Gap Buffer
- Module: `src/services/gap-detection-service.ts`
- `Map<cameraId, CircularBuffer<{ timestamp, celsius }>>`
- Buffer size: 180 entries (15min at 5s interval — covers max gap window)
- On each reading: push to buffer, then for each active gap threshold for that camera:
  - Look back `intervalMinutes` worth of entries
  - Compute `currentCelsius - oldestCelsius` in that window
  - If absolute value exceeds `maxGapCelsius` (and direction matches): fire alert
- Buffer resets on server restart (acceptable — rebuilds within 15min)

## Related Code Files

### Create
- `src/app/api/cameras/route.ts` — GET list, POST create
- `src/app/api/cameras/[cameraId]/route.ts` — GET, PUT, DELETE
- `src/app/api/readings/route.ts` — POST ingest, GET query
- `src/app/api/readings/latest/route.ts` — GET latest per camera
- `src/app/api/thresholds/temperature/route.ts` — GET, POST
- `src/app/api/thresholds/temperature/[id]/route.ts` — PUT, DELETE
- `src/app/api/thresholds/gap/route.ts` — GET, POST
- `src/app/api/thresholds/gap/[id]/route.ts` — PUT, DELETE
- `src/app/api/alerts/route.ts` — GET list
- `src/app/api/alerts/[id]/acknowledge/route.ts` — POST acknowledge
- `src/app/api/settings/email/route.ts` — GET, PUT
- `src/services/camera-service.ts`
- `src/services/reading-service.ts`
- `src/services/threshold-service.ts`
- `src/services/gap-detection-service.ts`
- `src/services/alert-service.ts`
- `src/services/email-service.ts`
- `src/lib/validate.ts` — shared input validation helpers

### Modify
- `src/lib/constants.ts` — add API-related constants (max batch size, default limits)

## Implementation Steps

1. **Create validation helpers** (`src/lib/validate.ts`)
   - `validateCameraInput(body)` — returns parsed data or error
   - `validateReadingInput(body)` — single or array, requires cameraId + celsius + timestamp
   - `validateThresholdInput(body)` — for both temperature and gap
   - Max batch size: 1000 readings per POST

2. **Implement camera service** (`src/services/camera-service.ts`)
   - `listCameras()` — return all cameras ordered by cameraId
   - `getCamera(cameraId)` — single camera or null
   - `createCamera(data)` — validate + insert
   - `updateCamera(cameraId, data)` — validate + update
   - `deleteCamera(cameraId)` — delete (cascade readings? No — soft check, reject if readings exist, or add query param `?force=true`)

3. **Implement camera API routes**
   - `src/app/api/cameras/route.ts`: GET → `listCameras()`, POST → `createCamera()`
   - `src/app/api/cameras/[cameraId]/route.ts`: GET, PUT, DELETE

4. **Implement reading service** (`src/services/reading-service.ts`)
   - `ingestReadings(readings[])` — bulk insert via `createMany`, then trigger alert evaluation
   - `queryReadings({ cameraId, from, to, limit })` — with default limit 500, ordered by timestamp desc
   - `getLatestReadings()` — latest reading per camera using Prisma raw query or distinct

5. **Implement alert evaluation in reading service**
   - After insert, call `evaluateThresholds(readings)` from threshold-service
   - Call `updateGapBuffer(readings)` + `evaluateGapThresholds(readings)` from gap-detection-service

6. **Implement threshold service** (`src/services/threshold-service.ts`)
   - CRUD for temperature_thresholds and gap_thresholds
   - `evaluateTemperatureThresholds(reading)`:
     - Load active thresholds for this camera + global thresholds
     - Cache thresholds in memory (invalidate on CRUD operations)
     - Check min/max bounds
     - Check cooldown (last alert time for this threshold+camera combo)
     - Return breached thresholds

7. **Implement gap detection service** (`src/services/gap-detection-service.ts`)
   - In-memory `Map<string, { timestamp: Date, celsius: number }[]>`
   - `updateBuffer(cameraId, timestamp, celsius)` — append, trim old entries
   - `evaluateGapThresholds(cameraId, currentCelsius, currentTimestamp)`:
     - Load active gap thresholds for camera + global
     - For each threshold: look back `intervalMinutes`, compute delta
     - Check direction (rise/drop/both) and magnitude
     - Check cooldown
     - Return breached thresholds

8. **Implement alert service** (`src/services/alert-service.ts`)
   - `createAlert(data)` — insert alert + fire notification (email + UI)
   - `listAlerts({ cameraId, type, acknowledged, from, to, page, limit })`
   - `acknowledgeAlert(id)` — set acknowledged=true, acknowledged_at=now
   - `getUnacknowledgedCount()` — for badge display

9. **Implement email service** (`src/services/email-service.ts`)
   - `sendAlertEmail(alert)` — format subject/body, send via Nodemailer
   - `getEmailConfig()` / `updateEmailConfig()` — store in a simple JSON file or env vars
   - Graceful failure: log error if SMTP not configured, don't crash

10. **Implement remaining API routes** (thresholds, alerts, settings)

11. **Test all endpoints** via curl or REST client
    - POST 1 reading, verify alert evaluation
    - POST batch of 100 readings
    - Query readings with time range
    - CRUD thresholds and verify cache invalidation

## Todo List
- [ ] Create validation helpers
- [ ] Implement camera service + routes
- [ ] Implement reading service + ingestion route
- [ ] Implement readings query + latest endpoints
- [ ] Implement threshold service + routes (temperature)
- [ ] Implement threshold service + routes (gap)
- [ ] Implement gap detection service (in-memory buffer)
- [ ] Implement alert service + routes
- [ ] Implement email service
- [ ] Implement settings/email route
- [ ] Wire alert evaluation into reading ingestion
- [ ] Test all endpoints manually
- [ ] Verify alert fires on threshold breach

## Success Criteria
- All endpoints return correct status codes and data
- POST /api/readings inserts data and triggers threshold evaluation
- Alerts created when thresholds breached
- Gap detection identifies rapid temperature changes
- Cooldown prevents duplicate alerts within window
- Email sends (or gracefully fails) on alert
- Batch ingestion of 1000 readings completes <2s

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Gap buffer lost on server restart | Low | Rebuilds within 15min; acceptable for local deploy |
| Threshold cache stale | Medium | Invalidate on every CRUD operation; cache TTL as fallback |
| Alert evaluation slows ingestion | Medium | Keep evaluation synchronous but fast; threshold cache avoids DB reads |
| BigInt reading IDs in JSON | Medium | Serialize as string in API responses |
| Concurrent ingestion race conditions | Low | Cooldown check uses DB timestamp; minor duplicate alerts acceptable |
