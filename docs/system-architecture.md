# System Architecture

Real-time thermal camera monitoring with synchronous alert evaluation on reading ingestion.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     BROWSER                                  │
│  (React 19, Tailwind CSS 4, Recharts 3.7, next-themes)     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Dashboard Components                       │  │
│  │  - Camera cards (live temps)                          │  │
│  │  - Charts (line, gap, comparison)                    │  │
│  │  - Settings forms (threshold mgmt)                   │  │
│  │  - Alert list & filters                              │  │
│  └──────────────────────────────────────────────────────┘  │
│               ↓ (every 5 seconds)                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Polling Hook (use-cameras)                    │  │
│  │  fetch /api/readings/latest → setState               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
              ↕ HTTP (REST API)
┌─────────────────────────────────────────────────────────────┐
│                   NEXT.JS SERVER                            │
│             (Node.js, TypeScript, App Router)              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            API Routes (14 endpoints)                  │  │
│  │  GET /api/cameras                                    │  │
│  │  POST /api/readings (+ alert evaluation)             │  │
│  │  GET /api/readings/latest (LATERAL JOIN)            │  │
│  │  GET/POST /api/thresholds/*                          │  │
│  │  GET/PUT /api/alerts/*                               │  │
│  │  GET/POST /api/groups/*                              │  │
│  │  GET/PUT /api/settings/email                         │  │
│  └──────────────────────────────────────────────────────┘  │
│               ↓                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Services (8 modules)                       │  │
│  │  - reading-service (bulk ingest, query)             │  │
│  │  - camera-service (CRUD)                            │  │
│  │  - alert-service (query, filter)                    │  │
│  │  - alert-evaluation-service (threshold check)       │  │
│  │  - threshold-service (threshold CRUD)               │  │
│  │  - threshold-cache (in-memory lookup)               │  │
│  │  - cooldown-manager (alert spam prevention)         │  │
│  │  - gap-ring-buffer (rate-of-change detection)       │  │
│  │  - email-service (Nodemailer)                       │  │
│  └──────────────────────────────────────────────────────┘  │
│               ↓                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Prisma Client (ORM)                        │  │
│  │  - Singleton instance (lib/prisma.ts)              │  │
│  │  - Raw SQL support ($queryRaw)                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
              ↕ PostgreSQL wire protocol
┌─────────────────────────────────────────────────────────────┐
│                  POSTGRESQL 12+                             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              6 Tables                                 │  │
│  │  - cameras (cameraId PK, status, groupId FK)        │  │
│  │  - groups (id PK, name, color)                      │  │
│  │  - readings (id PK, cameraId FK, celsius, ts)       │  │
│  │  - temperature_thresholds (id, cameraId/groupId, minCelsius, max) │  │
│  │  - gap_thresholds (id, cameraId/groupId, direction, maxGap)     │  │
│  │  - alerts (id, cameraId FK, type, acknowledged)     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             Key Indexes                              │  │
│  │  - readings(cameraId, timestamp) — Critical         │  │
│  │  - alerts(cameraId, createdAt)                      │  │
│  │  - alerts(acknowledged)                             │  │
│  │  - cameras(groupId)                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
              ↕ SMTP (optional)
         [Nodemailer → SMTP Server]
            (Alert notifications)
```

---

## Data Flow — Polling (5s Cycle)

```
Browser (Dashboard loaded)
  │
  ├─ [t=0s] useEffect hook initializes
  │  └─ setInterval(() => fetch /api/readings/latest, 5000ms)
  │
  ├─ [t=0s] GET /api/readings/latest
  │  └─ Server: reading-service.getLatestReadings()
  │     └─ Raw SQL LATERAL JOIN (PostgreSQL-specific)
  │        SELECT DISTINCT ON (camera_id)
  │          c.camera_id, c.name, c.location, c.status, c.group_id,
  │          r.id, r.celsius, r.timestamp
  │        FROM cameras c
  │        LEFT JOIN LATERAL (
  │          SELECT id, celsius, timestamp
  │          FROM readings
  │          WHERE camera_id = c.camera_id
  │          ORDER BY timestamp DESC LIMIT 1
  │        ) r ON true
  │        ORDER BY camera_id
  │     └─ Returns: [{ cameraId, name, location, status, groupId, celsius, timestamp }, ...]
  │  └─ Response: 200 OK (JSON array, <500ms for 50 cameras)
  │
  ├─ [t=0.5s] Browser receives response
  │  └─ React hook updates state: setCameras(data)
  │
  ├─ [t=0.5s] Components re-render
  │  ├─ CameraCard reads celsius + thresholds
  │  ├─ getTemperatureColor(celsius, thresholds) → "normal"|"warning"|"danger"
  │  └─ Tailwind applies color class (bg-green|yellow|red)
  │
  ├─ [t=5s] Timer fires again
  │  └─ Repeat fetch cycle
  │
  └─ [Loop continues...]

Latency breakdown:
  - Network latency: ~50-100ms
  - Database query: ~200-300ms (LATERAL JOIN optimized)
  - JSON serialization: ~50ms
  - Browser render: ~100-200ms
  - Total: <500ms (target: <5s polling interval)
```

---

## Data Flow — Reading Ingestion & Alert Evaluation

```
External System (Thermal Camera Network)
  │
  └─ POST /api/readings
     └─ Request body: [
          { cameraId: "cam-001", celsius: 42.5, timestamp: "2026-02-27T10:00:00Z" },
          { cameraId: "cam-002", celsius: 19.3, timestamp: "2026-02-27T10:00:00Z" },
          ...
        ]
     └─ Validation: validateReadingBatch() → throw ValidationError if invalid
     │
     └─ reading-service.ingestReadings(batch)
        │
        ├─ [1] Bulk insert into readings table
        │  └─ prisma.reading.createMany({ data: batch })
        │  └─ ~10-50 rows/second (600 rows/min at 5s interval)
        │
        ├─ [2] For EACH reading: alertEvaluationService.evaluateReading()
        │  │   (Receives: cameraId, celsius, timestamp, cameraGroupId)
        │  │
        │  ├─ [2a] Fetch thresholds (cached)
        │  │  └─ threshold-cache.getCachedThresholds()
        │  │
        │  ├─ [2b] Check TEMPERATURE threshold
        │  │  ├─ Filter by scope: Global OR camera-specific OR group-scoped
        │  │  │  ├─ Global: (cameraId = null AND groupId = null)
        │  │  │  ├─ Camera-specific: (cameraId = reading's cameraId)
        │  │  │  └─ Group-scoped: (groupId = reading's cameraGroupId)
        │  │  ├─ For each applicable threshold:
        │  │  │  ├─ Is celsius > maxCelsius? → danger
        │  │  │  ├─ Is celsius < minCelsius? → danger
        │  │  │  └─ Is celsius > 90% of max? → warning
        │  │  └─ If breach:
        │  │     ├─ Check cooldown (cooldown-manager.isOnCooldown)
        │  │     ├─ If !onCooldown:
        │  │     │  ├─ Create Alert record (type=TEMPERATURE)
        │  │     │  ├─ Start cooldown timer
        │  │     │  └─ Queue email notification (async, non-blocking)
        │  │
        │  ├─ [2c] Check GAP threshold (rate of change)
        │  │  ├─ gap-ring-buffer.addSample(cameraId, celsius, timestamp)
        │  │  │  └─ Append to in-memory circular buffer (60-sample default)
        │  │  ├─ Filter by scope: same as temperature (global/camera/group)
        │  │  ├─ For each applicable threshold:
        │  │  │  ├─ Look back N samples (based on intervalMinutes)
        │  │  │  ├─ Calculate Δcelsius = current - oldest
        │  │  │  ├─ Is |Δcelsius| > maxGapCelsius?
        │  │  │  │  ├─ And direction matches (RISE/DROP/BOTH)?
        │  │  │  │  └─ → gap threshold breached
        │  │  └─ If breach + !onCooldown:
        │  │     ├─ Create Alert record (type=GAP)
        │  │     ├─ Start cooldown timer
        │  │     └─ Queue email notification (async, non-blocking)
        │
        └─ [3] Email queue (async, non-blocking)
           ├─ Promise.all([sendAlert(...), sendAlert(...), ...])
           │  └─ Does NOT await, function returns immediately
           │
           ├─ email-service.sendAlert(to, subject, message)
           │  ├─ Uses Nodemailer config (SMTP_HOST, SMTP_PORT, etc.)
           │  ├─ If SMTP unavailable: log to console (graceful fallback)
           │  └─ Errors caught, logged, but don't propagate
           │
           └─ Browser/dashboard notified next poll cycle
              └─ GET /api/alerts shows new alerts

Response to client:
  └─ 200 OK: { inserted: N } (fast response, alert evaluation in background)

Alert latency:
  - Ingestion to creation: <1 second
  - Creation to UI visibility: <5 seconds (next polling cycle)
  - Creation to email: <1-5 seconds (depends on SMTP)
```

---

## Database Schema

```sql
-- Enum definitions
CREATE TYPE camera_status AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE alert_type AS ENUM ('TEMPERATURE', 'GAP');
CREATE TYPE gap_direction AS ENUM ('RISE', 'DROP', 'BOTH');

-- Groups (organize cameras)
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cameras (devices)
CREATE TABLE cameras (
  camera_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  status camera_status DEFAULT 'ACTIVE',
  group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cameras_group_id ON cameras(group_id);

-- Readings (temperature samples)
CREATE TABLE readings (
  id BIGSERIAL PRIMARY KEY,
  camera_id TEXT NOT NULL REFERENCES cameras(camera_id) ON DELETE CASCADE,
  celsius REAL NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL
);
-- CRITICAL: Composite index for query performance
CREATE INDEX idx_readings_camera_timestamp ON readings(camera_id, timestamp DESC);

-- Temperature thresholds (global, camera-specific, or group-scoped)
CREATE TABLE temperature_thresholds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  camera_id TEXT REFERENCES cameras(camera_id) ON DELETE CASCADE,
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  min_celsius REAL,
  max_celsius REAL,
  cooldown_minutes INT DEFAULT 5,
  notify_email BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Note: Scope is determined by which field is set:
-- If camera_id AND group_id are NULL → Global threshold (applies to all cameras)
-- If camera_id is set → Camera-specific (applies only to that camera)
-- If group_id is set → Group-scoped (applies to cameras in that group)

-- Gap thresholds (rate of change, global/camera/group-scoped)
CREATE TABLE gap_thresholds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  camera_id TEXT REFERENCES cameras(camera_id) ON DELETE CASCADE,
  group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
  interval_minutes INT NOT NULL,
  max_gap_celsius REAL NOT NULL,
  direction gap_direction DEFAULT 'BOTH',
  cooldown_minutes INT DEFAULT 5,
  notify_email BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Note: Scope is determined by which field is set:
-- If camera_id AND group_id are NULL → Global threshold
-- If camera_id is set → Camera-specific
-- If group_id is set → Group-scoped

-- Alerts (threshold breaches)
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  camera_id TEXT NOT NULL REFERENCES cameras(camera_id) ON DELETE CASCADE,
  type alert_type NOT NULL,
  message TEXT NOT NULL,
  celsius REAL NOT NULL,
  threshold_value REAL,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_alerts_camera_created ON alerts(camera_id, created_at DESC);
CREATE INDEX idx_alerts_acknowledged ON alerts(acknowledged);
```

---

## Component Hierarchy

```
app/layout.tsx (Server Root)
  │
  ├─ ThemeProvider (next-themes)
  │  └─ Dark/light mode context
  │
  ├─ Header (Client)
  │  ├─ Title + branding
  │  ├─ Theme toggle (sun/moon icons)
  │  └─ Temp unit toggle (°C / °F)
  │
  ├─ SidebarNav (Client)
  │  ├─ Link → /dashboard
  │  ├─ Link → /cameras
  │  ├─ Link → /alerts
  │  ├─ Link → /comparison
  │  └─ Link → /settings
  │
  └─ <children> (Page-specific)
     │
     ├─ /dashboard/page.tsx (Client)
     │  ├─ useCameras() hook (poll every 5s)
     │  ├─ useDashboardLayout() hook (localStorage)
     │  └─ DashboardDragPalette (draggable group chips)
     │  └─ DashboardDropZone (drop target)
     │     └─ CameraGrid
     │        └─ CameraCard[] (live temps + colors)
     │
     ├─ /cameras/page.tsx (Client)
     │  ├─ useCameras() hook
     │  ├─ CameraTable (list all)
     │  ├─ CameraFormDialog (add/edit)
     │  └─ GroupManager
     │
     ├─ /cameras/[cameraId]/page.tsx (Client)
     │  ├─ CameraInfoHeader
     │  ├─ useReadings() hook (query by range)
     │  ├─ TemperatureLineChart
     │  ├─ GapBarChart
     │  ├─ TimeRangeSelector
     │  └─ CustomTooltip
     │
     ├─ /comparison/page.tsx (Client)
     │  ├─ useCameras() hook
     │  └─ ComparisonChart (Recharts overlay)
     │
     ├─ /alerts/page.tsx (Client)
     │  ├─ useAlerts() hook
     │  ├─ AlertFilters (camera, type, acknowledged)
     │  └─ AlertList (table, acknowledge button)
     │
     └─ /settings/page.tsx (Client)
        ├─ TemperatureThresholdForm
        ├─ GapThresholdForm
        ├─ ThresholdLists
        └─ GroupManagement
```

---

## Service Dependency Graph

```
reading-service
  ├─ prisma (DB access)
  └─ alert-evaluation-service (evaluate on ingest)
     ├─ threshold-service (CRUD thresholds)
     ├─ threshold-cache (in-memory lookup)
     ├─ cooldown-manager (track cooldown)
     ├─ gap-ring-buffer (detect rate of change)
     └─ email-service (queue notifications)

camera-service
  └─ prisma

alert-service
  └─ prisma

threshold-service
  └─ prisma

threshold-cache
  └─ threshold-service

cooldown-manager
  └─ (in-memory Map, no DB)

gap-ring-buffer
  └─ (in-memory Map, no DB)

email-service
  └─ nodemailer (SMTP)

API routes
  ├─ reading-service
  ├─ camera-service
  ├─ alert-service
  ├─ threshold-service
  └─ email-service
```

---

## State Management

### Server State
- **Prisma Client** (singleton) — DB connection pool
- **Threshold Cache** — In-memory Map of thresholds
- **Ring Buffers** — In-memory Map<cameraId, CircularBuffer>
- **Cooldown Timers** — In-memory Map<cameraId, Map<thresholdId, Date>>

### Client State (React)

```typescript
// useCameras() hook
const [cameras, setCameras] = useState<CameraReading[]>([]);
const [thresholds, setThresholds] = useState<TemperatureThreshold[]>([]);

// useDashboardLayout() hook
const [panels, setPanels] = useState<Panel[]>([]);
// Persisted in localStorage: "dashboard-layout"

// useAlerts() hook
const [alerts, setAlerts] = useState<Alert[]>([]);
const [filters, setFilters] = useState<AlertFilters>({
  acknowledged: false,
  cameraId: null,
});

// Page-specific: useReadings() hook
const [readings, setReadings] = useState<Reading[]>([]);
const [timeRange, setTimeRange] = useState<"1h"|"6h"|"24h"|"7d">("24h");
```

### No Global State Manager
- Hooks manage local component state
- Redux/Zustand not needed (polling-based, no complex interactions)
- localStorage for dashboard layout persistence

---

## Caching Strategy

### Threshold Cache (In-Memory)

**Why:** Avoid database query per reading during evaluation

**When:** Loaded at startup, refreshed on create/update

```typescript
// src/services/threshold-cache.ts
let cachedThresholds: TemperatureThreshold[] = [];

export async function refreshCache() {
  cachedThresholds = await prisma.temperatureThreshold.findMany();
}

// Called during evaluation (always in cache, <1ms)
export function getCachedThresholds() {
  return cachedThresholds;
}
```

### Ring Buffer Cache (In-Memory)

**Why:** Track temperature samples for gap detection without DB queries

**When:** Samples added as readings come in, buffer rotates (FIFO)

```typescript
// src/services/gap-ring-buffer.ts
const buffers = new Map<string, RingBuffer>();

export function getBuffer(cameraId: string) {
  if (!buffers.has(cameraId)) {
    buffers.set(cameraId, new RingBuffer(60));  // 60-sample default
  }
  return buffers.get(cameraId)!;
}

// ~1KB per camera, 50 cameras = 50KB total
```

### Cooldown Cache (In-Memory)

**Why:** Prevent alert spam with simple timer

**When:** Started after alert creation, checked before next alert

```typescript
// src/services/cooldown-manager.ts
const cooldowns = new Map<string, Map<string, Date>>();

export function isOnCooldown(cameraId: string, thresholdId: string): boolean {
  const expiry = cooldowns.get(cameraId)?.get(thresholdId);
  if (!expiry) return false;
  return Date.now() < expiry.getTime();
}
```

### Dashboard Layout (localStorage)

**Why:** Persist user's drag-drop customizations

**When:** Read on component mount, written on panel add/remove/reorder

```typescript
// src/hooks/use-dashboard-layout.ts
const saved = localStorage.getItem("dashboard-layout");
const initialPanels = saved ? JSON.parse(saved) : [];

// On change:
localStorage.setItem("dashboard-layout", JSON.stringify(panels));
```

---

## Error Handling

### API Route Errors

```typescript
// Graceful degradation pattern
try {
  const data = await service.fetchData();
  return NextResponse.json(data);
} catch (err) {
  if (err instanceof ValidationError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  console.error("[GET /api/...]", err);  // Log but don't expose
  return NextResponse.json({ error: "Server error" }, { status: 500 });
}
```

### Alert Evaluation Errors

```typescript
// Non-blocking failures
try {
  await Promise.all(
    readings.map(r => evaluateReading(r.cameraId, r.celsius, r.timestamp))
  );
} catch (err) {
  console.error("[alert evaluation]", err);  // Log but continue
}
return { inserted: result.count };  // Success response anyway
```

### Email Notification Errors

```typescript
// Best-effort notification
readings.forEach(async (r) => {
  try {
    await sendAlertEmail(r.cameraId, r.celsius);
  } catch (err) {
    console.error("[email]", err);  // Log but don't bubble
  }
});
// Function returns immediately, email is background task
```

### Browser/Hook Errors

```typescript
// usePolling hook
const { data, error, isLoading } = usePolling("/api/readings/latest", 5000);

if (error) {
  // Display stale data, show error message
  return <div>Failed to fetch: {error.message}</div>;
}

if (isLoading && !data) {
  return <div>Loading...</div>;
}

return <CameraGrid cameras={data} />;
```

---

## Scalability Considerations

### Current Limits (Local Deployment)

| Resource | Current | Target | Action |
|----------|---------|--------|--------|
| **Cameras** | 50 | 100+ | Add read replicas |
| **Readings/sec** | 10 (600/min) | 50+ | Partition readings table |
| **Concurrent users** | 5 | 50+ | Add caching layer (Redis) |
| **Polling latency** | <500ms | <100ms | Upgrade to SSE/WebSocket |

### Upgrade Path

**Phase 1 (Current):**
- Single PostgreSQL instance
- Polling-based client refresh
- In-memory caches (threshold, ring buffer)

**Phase 2 (Future):**
- PostgreSQL with read replicas
- Redis for distributed caching (threshold-cache, cooldown)
- Server-Sent Events (SSE) for <2s latency

**Phase 3 (Future):**
- Partition readings table by time (monthly)
- Message queue (RabbitMQ/Kafka) for alert evaluation
- Multi-region setup with cross-region alert aggregation

---

## Security Considerations

### Current (Local Network Only)

- **No authentication** — Not required for on-premise deployments
- **No HTTPS** — Assumes private network
- **No API key validation** — Trusted ingestion source
- **No CORS restrictions** — Localhost only

### Future (If Multi-User)

- **LDAP/Active Directory** — User authentication
- **JWT tokens** — API key authentication
- **RBAC** — Camera-level permissions
- **HTTPS + TLS** — Encrypted transport
- **Audit logging** — Track threshold changes, alerts

### Database Security

- **SQL injection prevention** — Prisma parameterized queries
- **Input validation** — Custom validators on all inputs
- **No secrets in code** — SMTP credentials via .env.local

---

## Monitoring & Observability

### Metrics to Track

| Metric | Collection | Alert Threshold |
|--------|-----------|-----------------|
| **API latency** | console.time/log | >500ms |
| **Reading ingestion rate** | POST /readings response | <10 rows/sec |
| **Database size** | SQL: SELECT pg_database_size() | >50GB |
| **Alert creation rate** | COUNT alerts WHERE created_at > NOW()-1h | >100/hour |
| **Unacknowledged alerts** | COUNT alerts WHERE !acknowledged | >50 |
| **Email failures** | Error log count | >5 in 1h |
| **Polling failures** | Browser console errors | >3 in 10 min |

### Logging

```typescript
// Structured logging (console only for now)
console.log("[reading-service] Ingested 150 readings in 250ms");
console.warn("[threshold-cache] Cache refresh took 1200ms");
console.error("[email-service] SMTP connection failed", { host, port, error });
```

**Future:** Integrate with ELK, DataDog, or Grafana for centralized logging.

---

## Disaster Recovery

### Data Backup

- **Manual:** `pg_dump -d thermal_monitor > backup.sql` (daily)
- **Automated:** (Future) S3 daily snapshots + 30-day retention

### Recovery Steps

```bash
# Restore from backup
psql -d thermal_monitor < backup.sql

# Reset database (dev only)
npm run db:reset
npm run db:seed
```

### RTO/RPO

| Scenario | RTO | RPO | Recovery |
|----------|-----|-----|----------|
| **DB crash** | 30min | 1 day | Restore from backup |
| **Disk failure** | 1h | 1 day | Replace disk + restore |
| **Data corruption** | 2h | 1 day | Manual SQL cleanup |

---

## Unresolved Questions

- [ ] How to handle readings arriving out-of-order (later timestamp before earlier)?
- [ ] Should readings older than 30 days auto-purge?
- [ ] Upgrade to WebSocket — timeline?
- [ ] Multi-region alert aggregation design?
- [ ] AI-based anomaly detection — scope?
