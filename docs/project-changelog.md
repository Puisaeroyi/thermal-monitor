# Project Changelog

All significant changes, features, and fixes for the Thermal Monitor project.

---

## [0.3.0] - 2026-03-06 (RTSP Temperature Integration)

### Added
- Real-time temperature data collection from 50 Hanwha thermal cameras via RTSP ONVIF metadata
- `rtsp_metadata_temp_collector.py` enhanced with NULL output on failure and HTTP POST support
- `POST /api/temperature-readings` endpoint for batch temperature reading ingestion
- Auto INACTIVE detection — NULL readings automatically mark cameras offline
- CSV export endpoint (`GET /api/export-readings`) with date range filtering
- Offline badges on camera cards for INACTIVE status
- Chart gap display for NULL values (Recharts `connectNulls={false}`)
- Last-updated timestamp on camera cards
- Deployment scripts: `install-cron.sh` for cron setup, `test-collector.sh` for validation
- Cron job configured to run collection every 60 seconds with 8 parallel workers

### Changed
- Dashboard camera cards now indicate INACTIVE status with visual badge
- Temperature charts now show gaps instead of connecting NULL values
- Camera status automatically updates based on reading success/failure
- UI displays last updated time for each camera's readings

### Performance
- Collection duration: 60-80 seconds for all 50 cameras
- API batch ingest: <2 seconds
- CSV export (1 day data): <5 seconds
- Database growth: ~72K rows/day

### Security
- Phase 5 (credential encryption) deferred to v1.1

---

## [0.2.1] - 2026-03-05 (API Tester Tool)

### Added
- `POST /api/proxy` endpoint for server-side HTTP requests
- API Tester page at `/api-tester` for testing endpoints on private network
- Request form with method, headers, body, timeout inputs
- Response viewer with status, headers, formatted body, duration display
- Request history localStorage persistence (max 50 entries)
- Private IP validation (10.x.x.x, 172.16-31.x.x, 192.168.x.x, localhost)

### Security
- Rejects requests to public IPs by default

---

## [0.2.0] - 2026-03-03 (Core Features Complete)

### Added
- Phase 1: Project Setup (Next.js 16, TypeScript, Tailwind, shadcn/ui, Prisma 7)
- Phase 2: Database Schema (6 Prisma models, PostgreSQL migration, composite indexes)
- Phase 3: API Endpoints (14 REST endpoints, 9 service modules)
  - Cameras: GET/POST, CRUD by ID
  - Readings: GET, POST (bulk ingest), latest (optimized query)
  - Thresholds: Temperature/Gap CRUD
  - Alerts: GET, acknowledge, filters
  - Groups: CRUD, color management
  - Settings: Email configuration
- Phase 4: Dashboard Overview
  - Camera cards with live temperature + color status
  - Responsive grid layout
  - Status summary (OK/warning/danger counts)
  - Polling every 5s via `use-cameras` hook
- Phase 5: Camera Detail & Charts (planned but not yet implemented)
- Phase 6: Alerts & Thresholds
  - Alert evaluation on reading ingest
  - Threshold breach detection
  - Cooldown manager (prevent spam)
  - Gap detection (rate-of-change)
  - Email notification queue
- Phase 7: Settings & Notifications
  - Threshold management UI
  - Group management with color picker
  - Email settings
  - Nodemailer integration with SMTP fallback

### Database
- 50 seed cameras pre-configured
- 24h sample readings for testing
- Composite index on readings(camera_id, timestamp)
- Cascade deletes for data consistency

### Performance Baselines
- Latest readings query: <500ms for 50 cameras
- Expected growth: ~600 rows/min @ 5s interval
- Annual storage: ~21GB

---

## [0.1.0] - 2026-02-27 (Initial Release - MVP Setup)

### Added
- Project skeleton with Next.js 16 + TypeScript strict mode
- Tailwind CSS 4 with custom configuration
- shadcn/ui component library integration
- Prisma 7 ORM with PostgreSQL adapter
- Environment template (.env.local)
- Git repository initialization
- Seed scripts framework

---

## Unresolved Items

### Phase 5: Security (Deferred to v1.1)
- Encrypt camera credentials in database using pgcrypto
- Add decryption logic to Python script
- File permission hardening

### Future Enhancements (Backlog)
- [ ] WebSocket/SSE for real-time updates (v1.1)
- [ ] Redis caching for thresholds and SSE pub/sub (v1.1)
- [ ] Multi-user authentication (v2.0)
- [ ] Role-based access control (v2.0)
- [ ] Mobile app (React Native, v3.0)
- [ ] ML-based anomaly detection (v2.1)

---

## Dependencies Added

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.0.0 | Framework |
| react | 19.0.0 | UI library |
| prisma | 7.0.0 | ORM |
| tailwindcss | 4.0.0 | Styling |
| shadcn/ui | Latest | Component library |
| postgres | 16+ | Database |
| nodemailer | — | Email service |

---

## Notes for Development Team

- All major features now use service layer pattern for maintainability
- Database schema supports indefinite reading retention (consider 30-day purge for production)
- RTSP collection rate-limited to 1 request per camera per 60 seconds
- Dashboard refreshes every 60 seconds (RTSP) vs 5 seconds (simulated data, prior)
- CSV exports filtered by date range, no hard limit on rows
