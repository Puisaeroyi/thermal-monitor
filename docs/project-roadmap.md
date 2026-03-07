# Project Roadmap

Implementation progress and future phases for Thermal Monitor.

---

## Release Timeline

| Release | Version | Status | Target Date | Effort |
|---------|---------|--------|------------|--------|
| **Phase 1-3** | 0.1.0 | ✓ Complete | 2026-02-27 | 12h |
| **Phase 4-7** | 0.2.0 | ✓ Complete | 2026-03-03 | 20h |
| **API Tester** | 0.2.1 | ✓ Complete | 2026-03-05 | 2h |
| **RTSP Integration** | 0.3.0 | ✓ Complete | 2026-03-06 | 16h |
| **v1.0 (MVP)** | 1.0.0 | Ready | 2026-03-10 | — |
| **v1.1 (Scaling)** | 1.1.0 | Backlog | 2026-04-01 | — |
| **v2.0 (Enterprise)** | 2.0.0 | Backlog | 2026-06-01 | — |

---

## Phase Details & Progress

### Phase 1: Project Setup ✓ COMPLETE

**Status:** Delivered 2026-02-27

**Deliverables:**
- [x] Next.js 16 project initialized
- [x] TypeScript strict mode enabled
- [x] Tailwind CSS 4 configured
- [x] shadcn/ui primitives added
- [x] Prisma 7 + PostgreSQL adapter installed
- [x] Environment setup (.env.local template)
- [x] Seed scripts framework
- [x] Git repo initialized

**Effort:** 3 hours

**Notes:**
- Used `create-next-app` as bootstrap
- Locked tech stack to versions in package.json
- Established kebab-case naming conventions early

---

### Phase 2: Database Schema ✓ COMPLETE

**Status:** Delivered 2026-02-27

**Deliverables:**
- [x] 6 Prisma models defined (Camera, Group, Reading, TemperatureThreshold, GapThreshold, Alert)
- [x] PostgreSQL schema migrated
- [x] Composite index on readings(camera_id, timestamp) created
- [x] Enums for CameraStatus, AlertType, GapDirection
- [x] Foreign key relationships + cascade deletes configured
- [x] Seed data for 50 cameras + 24h sample readings

**Effort:** 4 hours

**Performance Baseline:**
- Readings: ~600 rows/min @ 5s interval
- Query time (getLatestReadings): <500ms for 50 cameras
- Database size: ~21GB/year

**Notes:**
- DISTINCT ON + LATERAL JOIN critical for performance
- Composite index reduces query time from 10s to <500ms
- Cascade delete prevents orphaned alerts/readings

---

### Phase 3: API Endpoints & Services ✓ COMPLETE

**Status:** Delivered 2026-02-27

**Deliverables:**
- [x] 14 REST endpoints implemented (cameras, readings, thresholds, alerts, groups, settings)
- [x] 9 service modules created (reading, camera, alert, threshold, cache, gap-buffer, email)
- [x] Input validation (custom ValidationError class)
- [x] Error handling (try-catch in all routes)
- [x] Prisma singleton (lib/prisma.ts)
- [x] Type definitions for all inputs/outputs

**API Endpoints:**
- `GET/POST /api/cameras` + CRUD by ID
- `GET /api/readings/latest` (LATERAL JOIN optimized)
- `POST /api/readings` (bulk ingest + alert evaluation)
- `GET /api/readings` (query with filters)
- `GET/POST /api/thresholds/temperature` + CRUD
- `GET/POST /api/thresholds/gap` + CRUD
- `GET /api/alerts` (with filters)
- `PUT /api/alerts/[id]/acknowledge`
- `GET/POST /api/groups` + CRUD
- `GET/PUT /api/settings/email`

**Effort:** 5 hours

**Key Patterns:**
- Service layer for all DB access
- Validation on all inputs
- Non-blocking error handling
- Raw SQL for bulk queries (no ORM overhead)

**Coverage:**
- All endpoints tested manually (localhost)
- Error cases covered (validation, DB errors)

---

### Phase 4: Dashboard Overview (In Progress)

**Status:** Implementation in progress

**Deliverables:**
- [ ] Dashboard page + layout (responsive grid)
- [ ] Camera cards with live temperature + color status
- [ ] Drag-and-drop customization (HTML5 DnD API)
- [ ] Group/camera palette (draggable chips)
- [ ] Drop zones (add/remove panels)
- [ ] Layout persistence (localStorage)
- [ ] Status summary (count of OK/warning/danger)
- [ ] Use-cameras hook (poll /api/readings/latest every 5s)

**Components:**
- DashboardPage (main container)
- CameraCard (individual tile)
- CameraGrid (responsive layout)
- DashboardDragPalette (source)
- DashboardDropZone (target)
- StatusSummary (counts)

**Effort:** 5 hours

**Dependencies:** Phase 3 (API endpoints complete)

**Success Criteria:**
- [ ] 50 cameras displayed with live temps
- [ ] Drag-drop works in Firefox + Chrome
- [ ] Layout persists across page reloads
- [ ] Color coding matches thresholds (green/yellow/red)
- [ ] Refresh latency <5s

---

### Phase 5: Camera Detail & Charts (Planned)

**Status:** Planned for 2026-03-01

**Deliverables:**
- [ ] Camera detail page (/cameras/[cameraId])
- [ ] Temperature line chart (Recharts)
- [ ] Gap threshold bar chart
- [ ] Time range selector (1h, 6h, 24h, 7d)
- [ ] Use-readings hook (query with date filters)
- [ ] Camera info header (location, status, latest temp)
- [ ] Custom tooltip (date, temp, status)

**Components:**
- CameraDetailPage
- TemperatureLineChart
- GapBarChart
- TimeRangeSelector
- CameraInfoHeader
- CustomTooltip

**Effort:** 5 hours

**Dependencies:** Phase 3 (API endpoints)

**Success Criteria:**
- [ ] Charts render 7 days of data
- [ ] Time range selection works
- [ ] Tooltips show accurate values
- [ ] Charts responsive on mobile

---

### Phase 6: Alerts & Thresholds (Planned)

**Status:** Planned for 2026-03-02

**Deliverables:**
- [ ] Alert list page (/alerts)
- [ ] Alert filters (camera, type, acknowledged)
- [ ] Acknowledge button (set flag + timestamp)
- [ ] Temperature threshold form (create/edit/delete)
- [ ] Gap threshold form (create/edit/delete)
- [ ] Threshold lists (CRUD UI)
- [ ] Alert badge (unacknowledged count)
- [ ] Alert evaluation integration (reading-service)

**Services & Hooks:**
- alert-evaluation-service (threshold check on ingest)
- threshold-cache (in-memory lookup)
- hasUncheckedAlert (state-based suppression)
- gap-ring-buffer (rate-of-change detection)
- use-alerts hook (fetch + filter)

**Effort:** 5 hours

**Dependencies:** Phase 3 (API endpoints)

**Success Criteria:**
- [ ] Threshold breaches create alerts
- [ ] Cooldown prevents duplicate alerts (e.g., 5min)
- [ ] Gap detection works (e.g., 10°C/5min)
- [ ] Acknowledge persists + removes badge
- [ ] Email notifications queued (non-blocking)

---

### Phase 7: Settings & Notifications (Planned)

**Status:** Planned for 2026-03-03

**Deliverables:**
- [ ] Settings page (/settings)
- [ ] Temperature threshold management
- [ ] Gap threshold management
- [ ] Group management (create/edit/delete with color picker)
- [ ] Email notification settings
- [ ] Threshold lists (view + delete existing)
- [ ] SMTP configuration (.env.local)
- [ ] Email service (Nodemailer integration)
- [ ] Graceful fallback (log if SMTP unavailable)

**Components:**
- SettingsPage
- TemperatureThresholdForm
- GapThresholdForm
- ThresholdLists
- GroupManagement
- ColorPicker

**Services:**
- email-service (Nodemailer, send alerts)

**Effort:** 5 hours

**Dependencies:** Phase 3 (API endpoints), Phase 6 (alert evaluation)

**Success Criteria:**
- [ ] Create/edit/delete thresholds work
- [ ] Email notifications sent on breach
- [ ] SMTP failure doesn't block reading ingestion
- [ ] Group colors persist
- [ ] Settings form validation works

---

### Phase 8: API Tester (Complete)

**Status:** Delivered 2026-03-05

**Deliverables:**
- [x] POST /api/proxy endpoint (server-side HTTP proxy)
- [x] Private IP validation (10.x.x.x, 172.16-31.x.x, 192.168.x.x, localhost)
- [x] Request form (URL, method, headers, body, timeout)
- [x] Response viewer (status, headers, formatted body, duration)
- [x] Request history (localStorage, max 50 entries)
- [x] API Tester page (/api-tester)
- [x] Sidebar navigation link

**Components:**
- ApiTesterPage (main container)
- RequestForm (URL, method, headers, body inputs)
- ResponseViewer (response display with copy button)
- RequestHistory (sidebar with history list)
- useRequestHistory hook (localStorage persistence)

**Effort:** 2 hours

**Dependencies:** Phase 3 (API endpoints complete)

**Success Criteria:**
- [x] Can send GET/POST/PUT/DELETE/PATCH requests to local network IPs
- [x] Rejects requests to public IPs (security)
- [x] Response displays status, headers, body, duration
- [x] History persists across page refreshes
- [x] Click history entry reloads request into form
- [x] Build passes with no errors

---

## v0.2.0 Completion Criteria

**Release Date:** 2026-03-03

**Definition of Done:**
- [x] All 7 phases implemented
- [ ] All features tested on localhost
- [ ] Documentation 100% complete
- [ ] No console errors in browser
- [ ] Linting passes (`npm run lint`)
- [ ] Database seeded with 50 cameras
- [ ] Drag-drop dashboard works
- [ ] Alerts fire within 1s of threshold breach
- [ ] Email notifications functional (with fallback)
- [ ] Dark mode toggle works
- [ ] Mobile responsive (sidebar hidden on mobile)

**Testing:**
- [ ] Manual testing on Chrome/Firefox/Safari
- [ ] Polling latency <5s verified
- [ ] Database query time <500ms verified
- [ ] 50 camera dashboard performance acceptable
- [ ] Drag-drop on mobile tested

**Deliverables:**
- README.md — Setup + quick start
- docs/project-overview-pdr.md — Requirements + vision
- docs/codebase-summary.md — File-by-file guide
- docs/code-standards.md — Conventions + patterns
- docs/system-architecture.md — Diagrams + data flows
- docs/project-roadmap.md — This file
- docs/deployment-guide.md — Production setup

---

### Phase 9: RTSP Temperature Integration (Complete)

**Status:** Delivered 2026-03-06

**Deliverables:**
- [x] Python RTSP metadata collector script (50 cameras, 8 parallel workers)
- [x] POST /api/temperature-readings endpoint (batch ingest)
- [x] NULL → INACTIVE auto-detection (honest data on failure)
- [x] CSV export endpoint with date filtering
- [x] Dashboard enhancements (offline badges, chart gaps, stale data indicator)
- [x] Deployment scripts (install-cron.sh, test-collector.sh)

**Key Features:**
- Real-time thermal camera integration (Hanwha RTSP/ONVIF)
- 50 cameras collected every 60 seconds (8 parallel workers, <80s total)
- Historical data persistence in PostgreSQL
- Auto INACTIVE status on collection failures
- Gap display in charts (connectNulls={false})
- Last-updated timestamp on camera cards
- CSV export of readings with date range filtering

**Components Modified:**
- `rtsp_metadata_temp_collector.py` — NULL output on failure, HTTP POST
- `src/app/api/temperature-readings/route.ts` — New endpoint
- `src/components/dashboard/alert-summary.tsx` — Stale data indicator
- `src/components/dashboard/group-camera-grid.tsx` — Offline badges, chart gaps
- `src/lib/validate.ts` — Input validation

**Services:**
- Temperature reading ingestion (POST handler)
- Status auto-update (NULL → INACTIVE, valid → ACTIVE)
- CSV export service

**Effort:** 16 hours

**Success Criteria:**
- [x] Python script collects from all 50 cameras
- [x] API endpoint accepts batch readings
- [x] NULL readings mark camera INACTIVE
- [x] Charts show gaps for NULL values
- [x] CSV export works with date filters
- [x] Dashboard shows last-updated time
- [x] Cron job deployment tested

**Performance Baselines:**
- Collection duration: 60-80s for 50 cameras
- API ingest time: <2s for batch
- CSV export (1 day): <5s

**Database Impact:**
- ~72K rows/day (50 cameras × 1440 min/day)
- NULL values supported natively (already nullable columns)
- No schema migration required

---

## Future Phases (Backlog)

### v1.1: Scaling & Performance (Q2 2026)

**Effort:** 20 hours

**Goals:**
- Support 100+ cameras
- <2s polling latency (SSE/WebSocket)
- Distributed alert evaluation (message queue)

**Features:**
- [ ] Server-Sent Events (replace polling)
- [ ] Redis caching (threshold-cache)
- [ ] Message queue (RabbitMQ/Kafka) for alerts
- [ ] Database read replicas
- [ ] Readings table partitioning (by month)
- [ ] Metrics export (Prometheus)
- [ ] Grafana dashboard integration

**New Endpoints:**
- `GET /api/metrics` (Prometheus format)
- `GET /api/health` (liveness probe)

---

### v2.0: Enterprise Features (Q3 2026)

**Effort:** 40 hours

**Goals:**
- Multi-user support
- RBAC (role-based access control)
- Audit logging
- HTTPS + TLS
- HA deployment

**Features:**
- [ ] LDAP/Active Directory authentication
- [ ] JWT token-based API keys
- [ ] Camera-level permissions (read/write/admin)
- [ ] Audit log (threshold changes, alerts)
- [ ] HTTPS with Let's Encrypt
- [ ] Multi-instance deployment (load balanced)
- [ ] Cross-region replication
- [ ] Alert escalation (PagerDuty/Slack integration)

**New Models:**
- User (LDAP/AD sync)
- Role (Admin, Operator, Viewer)
- Permission (per-camera access)
- AuditLog (action, user, timestamp)

---

### v2.1: ML & Anomaly Detection (Q4 2026)

**Effort:** 30 hours

**Goals:**
- Predict threshold breaches
- Detect anomalies automatically
- Reduce false positives

**Features:**
- [ ] Time-series forecasting (Prophet/ARIMA)
- [ ] Anomaly score per reading
- [ ] ML-based threshold recommendations
- [ ] Seasonal pattern detection
- [ ] Root cause analysis (correlations between cameras)

---

### v3.0: Mobile & IoT (2027)

**Effort:** 50 hours

**Goals:**
- Native iOS/Android app
- Direct camera integration (RTSP/MQTT)
- Offline mode

**Features:**
- [ ] Native mobile app (React Native)
- [ ] Push notifications
- [ ] Offline data sync
- [ ] RTSP stream viewing
- [ ] MQTT broker support
- [ ] Camera firmware OTA updates

---

## Known Limitations (Current)

| Limitation | Workaround | Future Fix |
|-----------|-----------|-----------|
| No user auth | Assume private network | v2.0 LDAP |
| Polling latency (5s) | Acceptable for monitoring | v1.1 SSE/WebSocket |
| In-memory caches lost on restart | Restart during low activity | v1.1 Redis |
| No data export | Manual SQL queries | v1.1 CSV export API |
| No data purge | Manual cleanup | v1.1 Auto-archival |
| Single region | No multi-region | v2.0 Replication |

---

## Dependencies & External Services

| Service | Purpose | Required? | Fallback |
|---------|---------|-----------|----------|
| PostgreSQL 12+ | Primary database | Yes | None |
| SMTP server | Email alerts | No | Log to console |
| Nodejs 18+ | Runtime | Yes | None |
| npm | Package manager | Yes | yarn/pnpm |

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-----------|-----------|
| **Polling latency unacceptable** | Users miss alerts | Medium | Upgrade to SSE early |
| **Database performance degrades** | Queries >1s timeout | Low | Composite index + partitioning |
| **SMTP unavailable** | Email alerts fail | Low | Graceful fallback, queue system |
| **localStorage cleared** | Dashboard layout reset | Low | Provide UI to save layouts |
| **Browser crashes** | Data loss | Low | Use IndexedDB for offline data |
| **Disk full** | Unplanned downtime | Low | Auto-archival + alerts |

---

## Success Metrics (v0.2.0)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Feature Completeness** | 100% of phase requirements | Checklist |
| **API Latency** | <500ms for 50 cameras | Load test |
| **Alert Latency** | <1s from ingestion to creation | E2E test |
| **Uptime** | 99.5% monthly | Monitoring |
| **Test Coverage** | >80% critical paths | Test framework |
| **Documentation** | 100% API + architecture | Peer review |
| **Developer Onboarding** | <1h for new dev | Trial run |

---

## Communication & Stakeholder Updates

**Weekly Standup:** Every Monday, 10am
- Progress on current phase
- Blockers & dependencies
- Next week outlook

**Phase Retrospective:** Upon phase completion
- What went well
- What to improve
- Lessons learned

**Quarterly Review:** End of Q1, Q2, Q3, Q4
- Overall roadmap progress
- Prioritization of next quarter
- Budget/resource allocation

---

## Unresolved Questions

- [ ] Should readings be purged after 30 days or kept indefinitely?
- [ ] WebSocket priority — essential for v1.0 or acceptable for v1.1?
- [ ] Multi-region deployment — in scope for v2.0?
- [ ] AI anomaly detection — nice-to-have or core requirement?
- [ ] Mobile app — native (React Native) or web PWA?
- [ ] Cost analysis for AWS/GCP vs on-premise?
