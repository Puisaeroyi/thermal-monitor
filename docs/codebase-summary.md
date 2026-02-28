# Codebase Summary

Generated from repomix repository pack (116 files, 84.5K tokens).

---

## Project Overview

**Thermal Monitor** — Real-time thermal camera monitoring with live dashboards, threshold evaluation, and alert management. 40-50 cameras polled at 5-second intervals. Built with Next.js 16, React 19, PostgreSQL, Prisma 7, Tailwind CSS 4, shadcn/ui, Recharts 3.7.

**Stack:** Next.js (App Router) | TypeScript | PostgreSQL | Prisma | React 19 | Recharts | Tailwind 4 | shadcn/ui | Nodemailer

---

## Directory Structure

```
thermal-monitor/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # REST API endpoints
│   │   │   ├── alerts/               # Alert CRUD + acknowledge
│   │   │   ├── cameras/              # Camera CRUD
│   │   │   ├── groups/               # Group CRUD
│   │   │   ├── readings/             # Ingest + latest readings
│   │   │   └── thresholds/           # Temperature + gap thresholds
│   │   ├── alerts/page.tsx           # Alert list + filters
│   │   ├── cameras/                  # Camera list + detail page
│   │   ├── comparison/page.tsx       # Multi-camera chart
│   │   ├── dashboard/page.tsx        # Drag-drop dashboard
│   │   ├── settings/page.tsx         # Threshold + group settings
│   │   └── layout.tsx                # Root layout (sidebar + header)
│   ├── components/                   # React components (domain-organized)
│   │   ├── alerts/                   # Badge, filters, list
│   │   ├── cameras/                  # Form, table, header
│   │   ├── charts/                   # Line, comparison, gap charts
│   │   ├── dashboard/                # Card, grid, palette, drop-zone
│   │   ├── layout/                   # Header, sidebar-nav, theme-provider
│   │   ├── settings/                 # Threshold forms, group mgmt
│   │   └── ui/                       # shadcn/ui primitives
│   ├── hooks/                        # Custom React hooks
│   │   ├── use-cameras.ts            # Poll latest readings + thresholds
│   │   ├── use-polling.ts            # Generic polling wrapper
│   │   ├── use-readings.ts           # Query readings by camera
│   │   ├── use-alerts.ts             # Fetch alerts + filters
│   │   └── use-dashboard-layout.ts   # Drag-drop panel state (localStorage)
│   ├── lib/                          # Utilities
│   │   ├── prisma.ts                 # Singleton Prisma client
│   │   ├── validate.ts               # Input validation (custom, no zod)
│   │   ├── temperature-utils.ts      # formatTemperature, getColor, getTimeSince
│   │   ├── constants.ts              # DEFAULT_READINGS_LIMIT, MAX_BATCH_SIZE
│   │   └── utils.ts                  # cn() class merge
│   ├── services/                     # Business logic + DB access
│   │   ├── reading-service.ts        # Bulk ingest, query, latest readings (raw SQL LATERAL JOIN)
│   │   ├── camera-service.ts         # Camera CRUD
│   │   ├── alert-service.ts          # Alert queries + filtering
│   │   ├── alert-evaluation-service.ts   # Evaluate readings vs thresholds, create alerts
│   │   ├── threshold-service.ts      # Temperature + gap threshold CRUD
│   │   ├── threshold-cache.ts        # In-memory threshold lookup
│   │   ├── cooldown-manager.ts       # Track alert cooldown periods
│   │   ├── gap-ring-buffer.ts        # Ring buffer for gap detection
│   │   └── email-service.ts          # Nodemailer integration
│   └── types/                        # TypeScript interfaces
│       ├── camera.ts
│       ├── threshold.ts
│       └── alert.ts
├── prisma/
│   ├── schema.prisma                 # 6 models (Camera, Group, Reading, TemperatureThreshold, GapThreshold, Alert)
│   ├── migrations/                   # SQL migrations (init + add_groups)
│   └── seed/
│       ├── seed.ts                   # Main seed script
│       ├── camera-seed-data.ts       # Sample camera fixtures
│       ├── reading-generator.ts      # Synthetic reading generator
│       └── seed-live.ts              # Live streaming seed
├── scripts/
│   └── seed-live.ts                  # CLI for streaming test data
├── public/                           # Static assets (SVGs)
├── package.json                      # Dependencies + scripts
├── prisma.config.ts (TODO)           # Prisma client config
├── .env.local (TODO)                 # DATABASE_URL, SMTP_*
└── tsconfig.json                     # TypeScript config

plans/
├── 260227-0117-thermal-camera-monitoring/
│   ├── plan.md                       # Overview + phase table
│   ├── phase-01-project-setup.md
│   ├── phase-02-database-schema.md
│   ├── phase-03-api-endpoints.md
│   ├── phase-04-dashboard-overview.md
│   ├── phase-05-camera-detail-charts.md
│   ├── phase-06-threshold-alerts.md
│   └── phase-07-settings-notifications.md
└── reports/                          # Completed phase reports
```

---

## Database Schema (6 Models)

### Camera
- `cameraId` (String, PK) — Unique device identifier
- `name`, `location` — Display info
- `status` (CameraStatus) — ACTIVE | INACTIVE
- `groupId` (FK→Group) — Organization
- `createdAt`, `updatedAt` (DateTime)
- **Relations:** readings[], alerts[], group
- **Indexes:** (groupId)

### Group
- `id` (String, PK, cuid)
- `name`, `color` (String) — Display + organization
- `createdAt`, `updatedAt`
- **Relations:** cameras[]

### Reading
- `id` (BigInt, PK, auto-increment) — Serialized to string in API
- `cameraId` (FK→Camera), `celsius` (Float), `timestamp` (Timestamptz)
- **Relations:** camera
- **Indexes:** (cameraId, timestamp) — Critical for 600 rows/min queries
- **Scale:** ~315M rows/year @ 5s interval, ~21GB storage

### TemperatureThreshold
- `id`, `name`, `cameraId` (optional) — Global or per-camera
- `minCelsius`, `maxCelsius` (Float, optional) — Bounds
- `cooldownMinutes` (Int, default 5) — Prevent alert spam
- `notifyEmail`, `enabled` (Boolean)
- `createdAt`, `updatedAt`

### GapThreshold
- `id`, `name`, `cameraId` (optional) — Global or per-camera
- `intervalMinutes` (Int) — Sample period (e.g., 5min)
- `maxGapCelsius` (Float) — Max allowed change
- `direction` (GapDirection) — RISE | DROP | BOTH
- `cooldownMinutes`, `notifyEmail`, `enabled`, `createdAt`, `updatedAt`

### Alert
- `id`, `cameraId` (FK→Camera), `type` (AlertType) — TEMPERATURE | GAP
- `message`, `celsius`, `thresholdValue` (Float)
- `acknowledged` (Boolean), `acknowledgedAt` (DateTime, nullable)
- `createdAt`
- **Relations:** camera
- **Indexes:** (cameraId, createdAt), (acknowledged)

---

## API Routes (14 Endpoints)

### Cameras
- `GET /api/cameras` → listCameras() → Camera[]
- `POST /api/cameras` → createCamera(CameraInput) → Camera
- `GET /api/cameras/[cameraId]` → getCamera() → Camera | null
- `PUT /api/cameras/[cameraId]` → updateCamera() → Camera
- `DELETE /api/cameras/[cameraId]` → deleteCamera() → {}

### Readings
- `GET /api/readings/latest` → getLatestReadings() → LatestReading[] (raw SQL LATERAL JOIN)
  - Returns: [{ cameraId, name, location, status, groupId, celsius, timestamp }]
- `POST /api/readings` → ingestReadings(ReadingInput[]) → { inserted: N }
  - Validates batch (max 1000), inserts, evaluates thresholds, queues emails
- `GET /api/readings?cameraId&from&to&limit` → queryReadings(params) → Reading[]

### Thresholds
- `GET /api/thresholds/temperature` → listTemperatureThresholds() → TemperatureThreshold[]
- `POST /api/thresholds/temperature` → createTemperatureThreshold() → TemperatureThreshold
- `GET /api/thresholds/temperature/[id]` → getTemperatureThreshold() → TemperatureThreshold
- `PUT /api/thresholds/temperature/[id]` → updateTemperatureThreshold() → TemperatureThreshold
- `DELETE /api/thresholds/temperature/[id]` → deleteTemperatureThreshold() → {}
- (Same for `/api/thresholds/gap`)

### Alerts
- `GET /api/alerts?acknowledged&cameraId&skip&take` → listAlerts(filters) → Alert[]
- `POST /api/alerts` — Not used (alerts created via evaluation service)
- `PUT /api/alerts/[id]/acknowledge` → acknowledgeAlert(id) → Alert

### Groups
- `GET /api/groups` → listGroups() → Group[]
- `POST /api/groups` → createGroup(GroupInput) → Group
- `PUT /api/groups/[id]` → updateGroup() → Group
- `DELETE /api/groups/[id]` → deleteGroup() → {}

### Settings
- `GET /api/settings/email` → getEmailSettings() → EmailSettings
- `PUT /api/settings/email` → updateEmailSettings() → EmailSettings

---

## Services (8 Modules)

### reading-service.ts
**Purpose:** Bulk reading ingestion + queries

**Key Functions:**
- `ingestReadings(readings: ReadingInput[])` — Insert, evaluate thresholds, queue emails
- `queryReadings(params)` — Filter by camera, date range, limit; return newest-first
- `getLatestReadings()` — Raw SQL LATERAL JOIN for performance (retrieves latest per camera in single query)

**Implementation:** Prisma `createMany()` for bulk insert, `$queryRaw` for LATERAL JOIN, Promise.all for parallel alert evaluation.

### camera-service.ts
**Purpose:** Camera CRUD

**Key Functions:**
- `listCameras()` — All cameras with group relations
- `getCamera(id)` — Single camera detail
- `createCamera(input)` → validateCameraInput, insert
- `updateCamera(id, input)` → Partial update
- `deleteCamera(id)` → Cascade deletes readings + alerts

### alert-service.ts
**Purpose:** Alert querying + filtering

**Key Functions:**
- `listAlerts(filters)` — By acknowledged, camera, pagination (skip/take)
- `getAlert(id)` — Single alert
- `acknowledgeAlert(id)` → Set acknowledged=true, acknowledgedAt=now

### alert-evaluation-service.ts
**Purpose:** Threshold evaluation on ingestion

**Key Functions:**
- `evaluateReading(cameraId, celsius, timestamp)` — Called during reading ingestion
- Checks temperature thresholds (min/max)
- Checks gap thresholds (ring buffer)
- Respects cooldown (via cooldownManager)
- Creates Alert records
- Queues email notifications (non-blocking)

**Error Handling:** Failures logged but don't block reading ingestion.

### threshold-service.ts
**Purpose:** Temperature + gap threshold CRUD

**Key Functions:**
- `listTemperatureThresholds()`, `getTemperatureThreshold(id)`, `createTemperatureThreshold(input)`, `updateTemperatureThreshold(id, input)`, `deleteTemperatureThreshold(id)`
- (Same for gap thresholds)

**Validation:** Via `validateTemperatureThresholdInput()` and `validateGapThresholdInput()` in lib/validate.ts.

### threshold-cache.ts
**Purpose:** In-memory cache for threshold lookups

**Key Functions:**
- `getCachedThresholds()` — Returns thresholds from memory
- `refreshCache()` — Reload from DB (called at startup)

**Rationale:** Avoid per-reading DB query; re-load on threshold create/update.

### cooldown-manager.ts
**Purpose:** Prevent alert spam

**Key Functions:**
- `isOnCooldown(cameraId, thresholdId)` → Boolean
- `startCooldown(cameraId, thresholdId, minutes)` → void

**Implementation:** In-memory Map<string, Map<string, Date>>. Lost on restart (acceptable for local deployments).

### gap-ring-buffer.ts
**Purpose:** Track temperature samples for gap detection

**Key Functions:**
- `getBuffer(cameraId)` — Get or create ring buffer for camera
- `addSample(cameraId, celsius, timestamp)` → void
- `checkGap(maxGapCelsius, direction, intervalMinutes)` → Boolean

**Implementation:** Ring buffer of N samples (default 60) per camera, in memory.

### email-service.ts
**Purpose:** Nodemailer integration

**Key Functions:**
- `sendAlert(to, subject, message)` — Send email (best-effort, non-blocking)

**Environment Variables:**
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `ALERT_FROM_EMAIL`

**Graceful Fallback:** If SMTP unavailable, logs to console instead.

---

## Custom Hooks (5)

### use-cameras.ts
**Purpose:** Poll latest readings every 5s, fetch thresholds once

**Return Type:**
```typescript
{
  cameras: CameraReading[];      // Latest per camera
  thresholds: TemperatureThreshold[];
  isLoading: boolean;
  error: Error | null;
}
```

**Used by:** Dashboard, cameras list, comparison page.

### use-polling.ts
**Purpose:** Generic polling wrapper with error handling

**Signature:**
```typescript
usePolling<T>(url: string, intervalMs: number): { data: T | null, error: Error | null, isLoading: boolean }
```

**Implementation:** useEffect + setInterval, cleanup on unmount.

### use-readings.ts
**Purpose:** Query readings for single camera with time range

**Used by:** Camera detail page.

### use-alerts.ts
**Purpose:** Fetch alerts with filters (acknowledged, camera, pagination)

**Used by:** Alerts page.

### use-dashboard-layout.ts
**Purpose:** Manage drag-drop panel state, persist to localStorage

**Return Type:**
```typescript
{
  panels: Panel[];             // Current layout
  addPanel(groupId | "all") → void;
  removePanel(id) → void;
  reorderPanels(newOrder) → void;
}
```

**Used by:** Dashboard page only.

---

## Components (Organized by Domain)

### components/dashboard/
- **camera-card.tsx** — Single camera tile (temp, color status, last updated)
- **camera-grid.tsx** — Grid layout for cards
- **status-summary.tsx** — Count of OK/warning/danger cameras
- **dashboard-drag-palette.tsx** — Sidebar palette (draggable group chips)
- **dashboard-drop-zone.tsx** — Drop target for drag-and-drop

### components/cameras/
- **camera-form-dialog.tsx** — Add/edit camera modal
- **camera-info-header.tsx** — Detail page header
- **camera-table.tsx** — List of all cameras with latest readings

### components/charts/
- **temperature-line-chart.tsx** — Recharts LineChart (time-series)
- **comparison-chart.tsx** — Multi-camera overlay
- **gap-bar-chart.tsx** — Bar chart for gap threshold breaches
- **custom-tooltip.tsx** — Recharts custom tooltip
- **time-range-selector.tsx** — Date picker (last 1h / 6h / 24h / 7d)

### components/alerts/
- **alert-badge.tsx** — Unacknowledged count badge
- **alert-filters.tsx** — Filter controls (camera, type, acknowledged)
- **alert-list.tsx** — Table of alerts, acknowledge button

### components/settings/
- **temperature-threshold-form.tsx** — Create/edit threshold
- **gap-threshold-form.tsx** — Create/edit gap threshold
- **threshold-lists.tsx** — Show all thresholds, delete button
- **group-management.tsx** — Create/edit/delete groups, color picker

### components/layout/
- **header.tsx** — Top bar (title, theme toggle, temp unit toggle)
- **sidebar-nav.tsx** — Left nav (links to all pages)
- **theme-provider.tsx** — next-themes ThemeProvider wrapper

### components/ui/
- Button, Card, Dialog, Table, Select, Input, Badge, Tabs, etc. (shadcn/ui primitives)

---

## Utilities (lib/)

### lib/validate.ts
**Purpose:** Input validation (custom, no zod dependency)

**Key Functions:**
- `validateCameraInput(data, requireId)` → CameraInput | throw ValidationError
- `validateReadingBatch(data)` → ReadingInput[] | throw
- `validateTemperatureThresholdInput(data)` → TemperatureThresholdInput | throw
- `validateGapThresholdInput(data)` → GapThresholdInput | throw

**Strategy:** Manual type guards + meaningful error messages.

### lib/temperature-utils.ts
**Purpose:** Temperature formatting + color coding

**Key Functions:**
- `celsiusToFahrenheit(c)` → F (rounded to 1 decimal)
- `formatTemperature(celsius, unit)` → "23.5°C" or "74.3°F"
- `getTemperatureColor(celsius, thresholds)` → "normal" | "warning" | "danger" | "inactive"
  - Danger: above max or below min
  - Warning: >90% of max threshold
- `getTimeSince(timestamp)` → "5m ago" | "2h ago" | "3d ago"

### lib/constants.ts
**Purpose:** App-wide constants

**Key Values:**
- `DEFAULT_READINGS_LIMIT = 1000`
- `MAX_BATCH_SIZE = 1000` (readings per POST)
- `POLLING_INTERVAL_MS = 5000` (dashboard refresh)

### lib/prisma.ts
**Purpose:** Singleton Prisma client

**Export:** `export const prisma = new PrismaClient()`

### lib/utils.ts
**Purpose:** Tailwind CSS utility

**Key Function:**
- `cn(...classes)` — tailwind-merge for class merging

---

## Data Flow (Polling Architecture)

```
1. Browser (every 5s)
   └─ fetch /api/readings/latest
      └─ Server: reading-service.getLatestReadings()
         └─ SELECT DISTINCT ON (camera_id) ... LATERAL JOIN readings
            └─ Return [{ cameraId, celsius, status, groupId, ... }]
   └─ React re-render
      └─ use-cameras hook updates state
         └─ components render with new temps
         └─ getTemperatureColor(celsius, thresholds) → color code
            └─ Camera cards change color (green/yellow/red)
```

```
2. Ingest (POST /api/readings)
   └─ Validate batch
   └─ reading-service.ingestReadings([])
      └─ prisma.reading.createMany()
      └─ For each reading: evaluateReading()
         └─ Check temp thresholds
         └─ Check gap thresholds (ring buffer)
         └─ If breach + !onCooldown: create Alert
         └─ Queue email (non-blocking)
      └─ Return { inserted: N }
```

---

## Code Standards & Patterns

**Language:** TypeScript, strict mode enabled

**Naming:**
- Files: kebab-case (e.g., `alert-evaluation-service.ts`)
- Components: PascalCase (e.g., `TemperatureSensorCard.tsx`)
- Functions: camelCase (e.g., `getLatestReadings()`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_BATCH_SIZE`)
- Database fields: snake_case (e.g., `camera_id`, `created_at`)

**Error Handling:**
- Custom `ValidationError` for input validation
- try-catch in API routes, log errors to console
- Non-blocking email failures (log, continue)

**Size Management:**
- Aim for <200 lines per file
- Services handle DB logic
- Hooks handle React state + side effects
- Components focus on UI rendering

**Performance:**
- Raw SQL `$queryRaw` for LATERAL JOIN (faster than ORM for bulk)
- In-memory caches (threshold-cache, gap-ring-buffer)
- Polling instead of WebSocket (simpler, scales better locally)

**Testing:**
- Manual testing on localhost
- Seed data for local development
- Live seed for streaming tests

---

## Environment Variables (.env.local)

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/thermal_monitor
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=optional
SMTP_PASS=optional
ALERT_FROM_EMAIL=alerts@thermal.local
```

All optional except `DATABASE_URL`.

---

## Performance Baselines

| Metric | Baseline | Notes |
|--------|----------|-------|
| GET /latest (50 cameras) | <500ms | LATERAL JOIN optimized |
| POST /readings (1000 batch) | <1000ms | Bulk insert + evaluation |
| Dashboard refresh lag | <5s | Polling interval |
| Alert latency | <1s after ingestion | Synchronous evaluation |
| Memory per ring buffer | ~1KB per camera | 60-sample buffer, negligible |
| Database size (1 year) | ~21GB | 600 rows/min, composite index |

---

## Unresolved Questions

- [ ] Should readings be purged after 30 days (or 1 year)?
- [ ] Email notification: mandatory or optional?
- [ ] Upgrade path to WebSocket/SSE defined?
- [ ] Multi-region replication in scope?
