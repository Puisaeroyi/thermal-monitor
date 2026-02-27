---
phase: 6
title: "Threshold & Alert System"
status: pending
priority: P1
effort: 5h
depends_on: [3]
---

# Phase 6 — Threshold & Alert System

## Context Links
- [Plan Overview](./plan.md)
- [Phase 3 — API Endpoints](./phase-03-api-endpoints.md)
- [Phase 4 — Dashboard](./phase-04-dashboard-overview.md)

## Overview
Implement the full alert pipeline: temperature threshold evaluation, gap detection engine, cooldown management, alert creation, UI notifications (toast + badge + alert page), and email dispatch.

## Requirements

### Functional
- **Temperature thresholds**: min/max bounds, per-camera or global, cooldown
- **Gap thresholds**: rate of change over 5/10/15 min windows, direction-aware
- **Alert creation**: records threshold breach with context (reading, value, message)
- **Cooldown**: no repeat alert for same threshold+camera within cooldown_minutes
- **UI notifications**: toast on new alert, badge count in header, alert history page
- **Email notifications**: send email on alert (if configured and enabled for threshold)
- **Alert history page** (`/alerts`): filterable table of all alerts
- **Acknowledge**: mark alerts as acknowledged

### Non-Functional
- Alert evaluation <50ms per reading (must not slow ingestion)
- Cooldown check in-memory (avoid DB query per reading)
- Email failures don't crash or block ingestion
- Toast notifications non-blocking, auto-dismiss after 10s

## Architecture

### Alert Pipeline (detailed)

```
Reading ingested
  │
  ├── Temperature Threshold Check
  │   ├── Load active thresholds (cached in-memory)
  │   ├── For reading's camera: match camera-specific + global thresholds
  │   ├── For each threshold:
  │   │   ├── Check if celsius < min_celsius OR celsius > max_celsius
  │   │   ├── Check cooldown (last alert timestamp for threshold+camera)
  │   │   └── If breached + cooldown passed → create alert
  │   └── Return breached threshold IDs
  │
  ├── Gap Buffer Update
  │   ├── Push { timestamp, celsius } to camera's ring buffer
  │   └── Trim entries older than 15 minutes
  │
  └── Gap Threshold Check
      ├── Load active gap thresholds (cached in-memory)
      ├── For each gap threshold matching camera:
      │   ├── Look back `interval_minutes` in buffer
      │   ├── Compute delta = current - oldest_in_window
      │   ├── Check direction: RISE (delta > max), DROP (delta < -max), BOTH (|delta| > max)
      │   ├── Check cooldown
      │   └── If breached → create alert
      └── Return breached gap threshold IDs
```

### Cooldown Manager (`src/services/cooldown-manager.ts`)
```typescript
// In-memory map: `${thresholdId}:${cameraId}` → lastAlertTimestamp
class CooldownManager {
  private cooldowns: Map<string, Date> = new Map();

  canAlert(thresholdId: string, cameraId: string, cooldownMinutes: number): boolean
  recordAlert(thresholdId: string, cameraId: string): void
  clear(): void  // for testing
}
```
- Singleton instance, resets on server restart
- Key format: `threshold:${thresholdId}:camera:${cameraId}`

### Threshold Cache (`src/services/threshold-cache.ts`)
```typescript
class ThresholdCache {
  private tempThresholds: TemperatureThreshold[] = [];
  private gapThresholds: GapThreshold[] = [];
  private lastRefresh: Date | null = null;
  private TTL = 60_000; // 60s

  async getTemperatureThresholds(): Promise<TemperatureThreshold[]>
  async getGapThresholds(): Promise<GapThreshold[]>
  invalidate(): void  // called on CRUD operations
}
```

### Gap Ring Buffer (`src/services/gap-ring-buffer.ts`)
```typescript
class GapRingBuffer {
  private buffers: Map<string, { timestamp: Date, celsius: number }[]> = new Map();
  private maxAge = 15 * 60 * 1000; // 15 minutes

  push(cameraId: string, timestamp: Date, celsius: number): void
  getWindow(cameraId: string, windowMinutes: number): { oldest: Entry, newest: Entry } | null
  clear(cameraId?: string): void
}
```

### UI Notification Flow
```
Alert created (server)
  → Stored in DB
  → Client polls GET /api/alerts?acknowledged=false&limit=1&since=lastCheck
  → New alert detected → show toast notification
  → Update badge count in header
```

### Alert History Page
```
alerts/page.tsx
├── alert-filters.tsx     # Camera, type, status, date range
└── alert-list.tsx        # Table with pagination
    └── alert-row.tsx     # Single alert with acknowledge button
```

## Related Code Files

### Create
- `src/services/cooldown-manager.ts` — cooldown tracking (singleton)
- `src/services/threshold-cache.ts` — in-memory threshold cache
- `src/services/gap-ring-buffer.ts` — per-camera ring buffer
- `src/services/alert-evaluation-service.ts` — orchestrates full pipeline
- `src/components/alerts/alert-list.tsx` — alert history table
- `src/components/alerts/alert-filters.tsx` — filter controls
- `src/components/alerts/alert-row.tsx` — single alert row
- `src/components/alerts/alert-badge.tsx` — unacknowledged count badge
- `src/components/alerts/alert-notification-toast.tsx` — toast for new alerts
- `src/hooks/use-alerts.ts` — polls for new alerts, manages toast
- `src/app/alerts/page.tsx` — alert history page

### Modify
- `src/services/reading-service.ts` — integrate alert evaluation after ingestion
- `src/services/threshold-service.ts` — call `thresholdCache.invalidate()` on CRUD
- `src/services/alert-service.ts` — integrate email dispatch
- `src/components/layout/header.tsx` — add alert badge

## Implementation Steps

1. **Create cooldown manager** (`src/services/cooldown-manager.ts`)
   - Singleton exported as `cooldownManager`
   - `canAlert(thresholdId, cameraId, cooldownMinutes)`: check if enough time elapsed
   - `recordAlert(thresholdId, cameraId)`: store current timestamp
   - Keep it simple: Map with string keys, Date values

2. **Create threshold cache** (`src/services/threshold-cache.ts`)
   - Singleton exported as `thresholdCache`
   - Lazy-loads from DB on first access
   - Auto-refreshes if stale (>60s since last refresh)
   - `invalidate()` called from threshold CRUD operations
   - Separate getters for temperature and gap thresholds

3. **Create gap ring buffer** (`src/services/gap-ring-buffer.ts`)
   - Singleton exported as `gapRingBuffer`
   - `push()`: append entry, trim entries older than maxAge
   - `getWindow(cameraId, minutes)`: return oldest and newest entries within window
   - Handle edge case: not enough data in window yet (return null, skip evaluation)

4. **Create alert evaluation service** (`src/services/alert-evaluation-service.ts`)
   - Main function: `evaluateReading(cameraId, celsius, timestamp): Promise<Alert[]>`
   - Steps:
     a. Get temperature thresholds from cache (filter for camera + global)
     b. Check each threshold: bounds check + cooldown check
     c. Push reading to gap buffer
     d. Get gap thresholds from cache
     e. Check each gap threshold: window lookup + delta check + direction + cooldown
     f. For each breach: create alert via alert-service
   - Return created alerts (for potential real-time push later)

5. **Integrate into reading ingestion** (`src/services/reading-service.ts`)
   - After `createMany`, loop through readings and call `evaluateReading` for each
   - Use `Promise.all` for parallel evaluation (each reading independent)
   - Log alert count: `[Alert] 2 alerts triggered from 50 readings`

6. **Wire email dispatch** (`src/services/alert-service.ts`)
   - In `createAlert()`: after DB insert, check `notify_email` flag on threshold
   - If enabled: call `emailService.sendAlertEmail(alert)` — fire and forget (don't await)
   - Catch and log email errors

7. **Implement alert history page** (`src/app/alerts/page.tsx`)
   - Client component with filters + table
   - Filters: camera dropdown, alert type (temperature/gap), status (all/unacknowledged/acknowledged), date range
   - Table columns: timestamp, camera, type, message, reading value, status, actions
   - Pagination: 25 per page
   - Acknowledge button per row (or bulk acknowledge)

8. **Create alert filters component** (`src/components/alerts/alert-filters.tsx`)
   - Camera select (from camera list), type select, status select, date range picker
   - Applies filters as query params to API call

9. **Create alert list component** (`src/components/alerts/alert-list.tsx`)
   - shadcn Table with sortable columns
   - Each row shows alert details + acknowledge button
   - Severity indicator (icon/color based on how far over threshold)

10. **Create alert badge** (`src/components/alerts/alert-badge.tsx`)
    - Shows count of unacknowledged alerts
    - Polls every 10s via `usePolling`
    - Pulsing animation when count > 0

11. **Create alert toast hook** (`src/hooks/use-alerts.ts`)
    - Polls `GET /api/alerts?acknowledged=false&since=lastCheck` every 5s
    - On new alert: trigger shadcn toast notification
    - Toast shows: camera name, alert type, temperature value
    - Auto-dismiss after 10s, click → navigate to alerts page

12. **Update header** — add alert badge component

## Todo List
- [ ] Create cooldown manager (singleton)
- [ ] Create threshold cache (singleton)
- [ ] Create gap ring buffer (singleton)
- [ ] Create alert evaluation service
- [ ] Integrate evaluation into reading ingestion
- [ ] Wire email dispatch into alert creation
- [ ] Create alert filters component
- [ ] Create alert list/table component
- [ ] Implement alert history page
- [ ] Create alert badge for header
- [ ] Create alert toast notification hook
- [ ] Update header with alert badge
- [ ] Test: ingest reading that breaches threshold → alert created
- [ ] Test: cooldown prevents duplicate alerts
- [ ] Test: gap detection fires on rapid change
- [ ] Test: email sends on alert (or gracefully fails)
- [ ] Test: UI toast appears for new alerts

## Success Criteria
- Alert created within 1 ingestion cycle when threshold breached
- Cooldown correctly prevents duplicate alerts
- Gap detection identifies rapid changes across 5/10/15min windows
- Alert history page shows all alerts with working filters
- Acknowledge marks alert and updates badge count
- Toast notification appears for new alerts
- Email sends when configured (graceful failure when not)
- Alert evaluation adds <50ms to ingestion time

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Memory leak in ring buffer | Medium | Trim on every push; max entries = cameras * 180 = 9000 entries |
| Cooldown lost on restart | Low | Acceptable; worst case: one duplicate alert after restart |
| Cache stale after threshold CRUD | Medium | Explicit invalidation on every CRUD + TTL fallback |
| Email blocking ingestion | High | Fire-and-forget (no await), catch errors |
| Too many toasts | Low | Deduplicate by threshold+camera, max 5 visible toasts |
