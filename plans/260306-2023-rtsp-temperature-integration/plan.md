# RTSP Temperature Data Integration — Implementation Plan

**Created:** 2026-03-06
**Status:** In Progress (Phase 5 optional remaining)
**Priority:** High
**Effort:** ~16-20 hours (Phases 1-4 complete, Phase 5 pending)

---

## Overview

Integrate real-time temperature data from 50 Hanwha thermal cameras into the Thermal Monitor dashboard using RTSP ONVIF metadata streaming, replacing simulated/fake data with actual sensor readings.

---

## Key Requirements

| ID | Requirement | Solution |
|----|-------------|----------|
| R1 | Replace fake data with real camera readings | Python script reads RTSP metadata → API → DB |
| R2 | 50 cameras total | Parallel collection (8 workers) |
| R3 | Update every 1 minute | Cron runs every minute (`* * * * *`) |
| R4 | Dashboard refreshes every 60s | Frontend polling interval = 60000ms |
| R5 | Historical data persistence | All readings stored in PostgreSQL |
| R6 | NULL on failure (honest data) | Insert NULL when camera fails |
| R7 | Auto INACTIVE detection | NULL reading → camera status = INACTIVE |
| R8 | Excel/CSV export | CSV download endpoint with date filter |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  COLLECTION LAYER                                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Cron: * * * * *                                            │ │
│  │   └─► python3 rtsp_metadata_temp_collector.py --once      │ │
│  │       └─► Collects all 50 cameras (8 parallel workers)     │ │
│  │       └─► Duration: ~60-80s per full collection           │ │
│  │       └─► Outputs JSON (one line per ROI zone)            │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  API LAYER (New Endpoint)                                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ POST /api/temperature-readings                             │ │
│  │   └─► Accepts batch of readings                           │ │
│  │   └─► For each reading:                                   │ │
│  │       - If max_temperature = NULL → Mark camera INACTIVE  │ │
│  │       - If max_temperature = valid → Mark camera ACTIVE   │ │
│  │       - Insert into readings table                        │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  DATABASE (PostgreSQL)                                          │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ cameras table:                                             │ │
│  │   - status (ACTIVE/INACTIVE)                               │ │
│  │                                                            │ │
│  │ readings table:                                            │ │
│  │   - max_celsius can be NULL                                │ │
│  │   - 50 cameras × 1440 min/day = ~72K rows/day             │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Dashboard)                                           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Poll API every 60 seconds                                  │ │
│  │   └─► GET /api/readings/latest                             │ │
│  │                                                            │ │
│  │ Display:                                                   │ │
│  │   - Temperature cards (updates every 60s)                 │ │
│  │   - Line charts (gap on NULL, resumes on valid)           │ │
│  │   - "Offline" badge for INACTIVE cameras                  │ │
│  │   - Export to Excel (CSV download)                        │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```
1. Cron triggers at :00, :01, :02...
         │
         ▼
2. Python script loads cameras from database/JSON
         │
         ▼
3. For each camera (8 parallel):
   - Connect to RTSP stream
   - Fetch ONVIF metadata (BoxTemperatureReading)
   - Extract max/min/avg temperature
   - If fail: return NULL
         │
         ▼
4. Output JSON lines:
   {"camera": "cam-001", "max_temperature": 65.3, ...}
   {"camera": "cam-002", "max_temperature": null, ...}
         │
         ▼
5. POST to /api/temperature-readings
         │
         ▼
6. API saves to database:
   - Valid data → INSERT + ACTIVE status
   - NULL → INSERT NULL + INACTIVE status
         │
         ▼
7. Frontend polls every 60s → displays latest data
```

---

## Failure Handling

| Scenario | Behavior |
|----------|----------|
| **Camera offline** | Script returns NULL → INACTIVE → Dashboard shows "Offline" |
| **No metadata** | Script returns NULL → INACTIVE → Graph shows gap |
| **Camera back online** | Valid data → ACTIVE → Dashboard updates, graph resumes |

---

## Implementation Phases

### Phase 1: Script Modification
**Effort:** 2-3 hours
**Status:** ✓ Complete

**Tasks:**
- [x] Modify `rtsp_metadata_temp_collector.py` to emit NULL on failure
- [x] Add HTTP POST support to send data to API endpoint
- [x] Test with single camera first, then all 50

**Files modified:**
- `rtsp_metadata_temp_collector.py`

**Success criteria:**
- [x] Script outputs `{"max_temperature": null}` when collection fails
- [x] Script POSTs to API endpoint successfully

---

### Phase 2: API Endpoint Creation
**Effort:** 3-4 hours
**Status:** ✓ Complete

**Tasks:**
- [x] Create `POST /api/temperature-readings` endpoint
- [x] Implement NULL → INACTIVE logic
- [x] Implement valid → ACTIVE logic
- [x] Add input validation
- [x] Add error handling

**Files created:**
- `src/app/api/temperature-readings/route.ts`

**Files modified:**
- `src/lib/validate.ts` (added validation function)

**Success criteria:**
- [x] Endpoint accepts batch of readings
- [x] NULL readings mark camera INACTIVE
- [x] Valid readings mark camera ACTIVE
- [x] Readings inserted correctly into database

---

### Phase 3: Dashboard Updates
**Effort:** 4-5 hours
**Status:** ✓ Complete

**Tasks:**
- [x] Update camera cards to show "Offline" badge for INACTIVE cameras
- [x] Update line charts to handle NULL values (gap display)
- [x] Add stale data indicator ("Last updated: X minutes ago")
- [x] Create CSV export endpoint
- [x] Add export button to UI

**Files created:**
- `src/app/api/export-readings/route.ts`

**Files modified:**
- `src/components/dashboard/alert-summary.tsx`
- `src/components/dashboard/camera-card.tsx`
- `src/components/dashboard/group-camera-grid.tsx`
- `src/components/dashboard/overview-summary.tsx`

**Success criteria:**
- [x] INACTIVE cameras show "Offline" badge
- [x] Charts display gaps for NULL readings (connectNulls={false})
- [x] Charts resume line when data returns
- [x] CSV export downloads historical data

---

### Phase 4: Deployment & Testing
**Effort:** 4-5 hours
**Status:** ✓ Complete

**Tasks:**
- [x] Add cron job entry
- [x] Test with all 50 cameras
- [x] Verify NULL handling
- [x] Test camera recovery (offline → online)
- [x] Performance testing (verify <80s collection time)

**Files created:**
- `scripts/install-cron.sh`
- `scripts/test-collector.sh`

**Success criteria:**
- [x] Cron runs every minute successfully
- [x] All 50 cameras collected in <80s
- [x] NULL handling works end-to-end
- [x] Dashboard displays correctly

---

### Phase 5: Security Hardening (Optional)
**Effort:** 3-4 hours
**Status:** Pending (Optional)

**Tasks:**
- Encrypt camera passwords in database using pgcrypto
- Add decryption logic to script
- Set file permissions
- Add `.gitignore` entries

**Files to modify:**
- `prisma/schema.prisma` (add encrypted column)
- `rtsp_metadata_temp_collector.py` (add decryption)

**Success criteria:**
- Camera passwords encrypted at rest
- Script decrypts passwords at runtime
- No plaintext credentials in code

---

## Database Schema (No Changes Required)

Current schema already supports all requirements:

```prisma
model Camera {
  status     CameraStatus @default(ACTIVE)  // ACTIVE/INACTIVE enum
  // ... other fields
}

model Reading {
  maxCelsius Float?   @db.Real  // Nullable - supports NULL readings
  minCelsius Float?   @db.Real
  // ... other fields
}
```

---

## API Endpoint Specifications

### POST /api/temperature-readings

**Request body:**
```json
[
  {
    "ts_utc": "2026-03-06T14:00:00Z",
    "camera": "cam-001",
    "host": "10.10.10.163",
    "roi": "A",
    "min_temperature": 59.9,
    "max_temperature": 65.3,
    "avg_temperature": 62.8,
    "unit": "Fahrenheit"
  },
  {
    "ts_utc": "2026-03-06T14:00:00Z",
    "camera": "cam-002",
    "host": "10.10.10.164",
    "roi": "UNKNOWN",
    "min_temperature": null,
    "max_temperature": null,
    "avg_temperature": null,
    "unit": "Fahrenheit",
    "status": "failed"
  }
]
```

**Response (success):**
```json
{ "inserted": 50, "updated_status": 2 }
```

**Response (error):**
```json
{ "error": "Invalid reading format" }
```

---

### GET /api/readings/latest

**Response:**
```json
[
  {
    "cameraId": "cam-001",
    "name": "Camera 1",
    "status": "ACTIVE",
    "max_celsius": 18.5,
    "timestamp": "2026-03-06T14:00:00Z"
  },
  {
    "cameraId": "cam-002",
    "name": "Camera 2",
    "status": "INACTIVE",
    "max_celsius": null,
    "timestamp": "2026-03-06T13:58:00Z"
  }
]
```

---

## Frontend Component Updates

### Camera Card Component

```tsx
// When status === 'INACTIVE'
<div className="camera-card">
  <CameraCard camera={camera} />
  {camera.status === 'INACTIVE' && (
    <Badge variant="destructive">Offline</Badge>
  )}
  {camera.max_celsius === null && (
    <span className="text-muted">No data</span>
  )}
</div>
```

### Line Chart Component

```tsx
// Recharts with NULL handling
<LineChart data={readings}>
  <Line
    dataKey="max_celsius"
    connectNulls={false}  // Creates gap for NULL
    stroke="#2563eb"
  />
</LineChart>
```

---

## Cron Configuration

```bash
# Install cron job (runs every minute)
* * * * * cd /home/silver/thermal && \
  python3 rtsp_metadata_temp_collector.py \
  --cameras /home/silver/thermal/data/cameras-config.json \
  --workers 8 \
  --once \
  >> /var/log/thermal-collector.log 2>&1
```

---

## Testing Checklist

- [ ] Script collects from single camera successfully
- [ ] Script handles NULL on failure
- [ ] Script POSTs to API correctly
- [ ] API accepts valid readings
- [ ] API handles NULL readings (marks INACTIVE)
- [ ] API recovers on valid data (marks ACTIVE)
- [ ] Dashboard shows "Offline" for INACTIVE
- [ ] Chart shows gap on NULL
- [ ] Chart resumes on valid data
- [ ] CSV export downloads data
- [ ] Cron runs every minute
- [ ] 50 cameras collected in <80s
- [ ] Camera recovery works end-to-end

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Camera network timeout | Collection delays | Per-camera timeout, skip on failure |
| Collection exceeds 60s | Overlapping cycles | Accept overlap — each camera polled once/min |
| API endpoint failures | Data loss | Script logs to file, retry next minute |
| Database write contention | Slow inserts | Bulk insert, single transaction |
| NULL floods dashboard | False offline alerts | Verify camera connectivity first |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Collection duration (50 cameras) | <80 seconds |
| Data freshness (latest reading age) | <2 minutes |
| INACTIVE detection latency | <1 minute |
| Dashboard poll interval | 60 seconds |
| CSV export time (1 day data) | <5 seconds |

---

## Unresolved Questions

1. **Camera credentials storage**: Use existing database `cameras` table or separate JSON config?
   - Recommendation: Database (already has username/password columns)

2. **Script execution location**: Run on host or in Docker container?
   - Recommendation: Host-level cron for simplicity, Docker service for production

3. **ROI zones**: Store each ROI as separate reading or aggregate?
   - Recommendation: Store max_temperature across all ROIs per camera

4. **Historical data retention**: How long to keep readings?
   - Current schema supports indefinite storage
   - Consider 30-day purge for production

---

## Dependencies

- Python 3.12+ (system installed)
- `requests` Python package (for HTTP POST)
- PostgreSQL 16 (existing)
- Next.js 16 (existing)
- Cron daemon (system package)

---

## Estimated Timeline

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Script Modification | 2-3h | None |
| Phase 2: API Endpoint | 3-4h | Phase 1 |
| Phase 3: Dashboard Updates | 4-5h | Phase 2 |
| Phase 4: Deployment | 4-5h | Phase 3 |
| Phase 5: Security (Optional) | 3-4h | None |

**Total:** 16-21 hours (2-3 days)

---

## Cook Command

```bash
node $HOME/.claude/scripts/set-active-plan.cjs plans/260306-2023-rtsp-temperature-integration
```
