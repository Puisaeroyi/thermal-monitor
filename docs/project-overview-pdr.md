# Thermal Monitor — Project Overview & PDR

## Executive Summary

**Thermal Monitor** is a real-time temperature monitoring dashboard for industrial/on-premise thermal camera networks (40-50 cameras). It ingests readings at 5-second intervals, evaluates temperature and rate-of-change thresholds, fires alerts (UI + email), and provides live dashboards with drag-drop customization.

**Status:** Phases 1-3 complete (setup, schema, API). Phases 4-7 in progress (dashboard, charts, alerts, settings).

---

## Product Vision

Enable real-time temperature monitoring of distributed thermal cameras with minimal ops overhead:
- **Centralized view** — All cameras visible on one dashboard
- **Fast response** — 5-second latency from sensor to alert
- **Customizable** — Drag-drop dashboard layout, per-camera thresholds
- **Smart alerts** — Threshold + gap detection with cooldown to prevent spam
- **Dark mode** — Works 24/7 in any lighting
- **Local deployment** — No cloud, runs on-premise

---

## Requirements

### Functional Requirements (FR)

| ID | Feature | Status |
|----|---------|--------|
| FR1 | Ingest readings from thermal cameras (bulk API) | ✓ Complete |
| FR2 | Display latest temperature per camera with color status | ✓ In Progress |
| FR3 | Temperature threshold evaluation (min/max) | ✓ In Progress |
| FR4 | Gap threshold evaluation (rate of change) | ✓ In Progress |
| FR5 | Create + acknowledge alerts | ✓ In Progress |
| FR6 | Email notifications on threshold breach | ✓ In Progress |
| FR7 | Multi-camera comparison charts | Planned |
| FR8 | Drag-drop customizable dashboard | Planned |
| FR9 | Camera grouping (organize by location) | ✓ In Progress |
| FR10 | Time range filtering on detail pages | Planned |

### Non-Functional Requirements (NFR)

| ID | Requirement | Target | Status |
|----|-------------|--------|--------|
| NFR1 | Response time (GET /latest) | <500ms for 50 cameras | ✓ Met |
| NFR2 | Ingest throughput | 600 rows/min (10 rows/sec) | ✓ Met |
| NFR3 | Dashboard refresh latency | <5s (polling interval) | ✓ Met |
| NFR4 | Alert latency | <1s after reading ingestion | ✓ On track |
| NFR5 | Data retention | 30 days (configurable) | Planned |
| NFR6 | Database size | <30GB for 1 year @ 600 rows/min | ✓ Met |
| NFR7 | Dark mode support | Full Tailwind dark: variants | ✓ Complete |
| NFR8 | Mobile responsive | Sidebar hidden on mobile | ✓ Complete |

---

## Scope

### In Scope
- Real-time dashboard (polling-based, no WebSocket)
- Temperature + gap threshold evaluation
- Alert creation + acknowledgment
- Email notifications via Nodemailer
- Camera CRUD + grouping
- Threshold management UI
- Multi-camera comparison charts
- Dark mode theme switching
- Drag-drop dashboard customization

### Out of Scope
- User authentication (local network only)
- Historical data purge (manual SQL)
- Mobile app (web-responsive only)
- Integration with external monitoring systems
- Advanced ML-based anomaly detection

---

## Success Metrics

| Metric | Target | Owner |
|--------|--------|-------|
| **Uptime** | 99.5% (monthly) | DevOps |
| **Alert accuracy** | 0 false negatives, <5% false positives | QA |
| **Dashboard load time** | <2s at 50 cameras | Frontend |
| **Feature completion** | All 7 phases delivered | PM |
| **Test coverage** | >80% critical paths | QA |
| **Documentation completeness** | 100% API + architecture docs | Tech Lead |

---

## Technical Constraints

| Constraint | Rationale |
|-----------|-----------|
| **PostgreSQL only** | Required for LATERAL JOIN in `getLatestReadings()` |
| **Polling (not WebSocket)** | Simpler deployment, works behind any proxy |
| **No ORM relations in bulk inserts** | Performance — use raw SQL for readings |
| **In-memory gap buffer** | Avoid DB bloat, stateless services |
| **5-second polling interval** | Balance between latency and load |
| **Celsius storage** | Smaller floats, convert to F on read |

---

## Architecture Overview

**Polling-based client-server:**

```
Browser (5s poll)
  ↓ GET /api/readings/latest
Server (Next.js API route)
  ↓ Raw SQL LATERAL JOIN
PostgreSQL (cameras + readings)
  ↓ Response: [{ cameraId, celsius, status, ... }]
Browser (re-render with new temps)
```

**Alert evaluation (on ingestion):**

```
POST /api/readings [bulk array]
  ↓ Validate + insert readings
  ↓ For each reading: evaluate temperature thresholds
  ↓ For each reading: evaluate gap thresholds (in-memory buffer)
  ↓ If breach: create Alert record + queue email
  ↓ Response: { inserted: N }
```

---

## Technology Stack (Locked)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.1.6 |
| UI Library | React | 19.2.3 |
| UI Components | shadcn/ui | Radix primitives |
| Styling | Tailwind CSS | 4 |
| Charts | Recharts | 3.7 |
| Database | PostgreSQL | 12+ |
| ORM | Prisma | 7.4.1 |
| Email | Nodemailer | 8.0 |
| Theme | next-themes | 0.4.6 |
| Language | TypeScript | 5 |

---

## Timeline & Phases

| Phase | Effort | Status | Completion |
|-------|--------|--------|------------|
| 1. Setup (Node/Next/Prisma) | 3h | ✓ Complete | 2026-02-27 |
| 2. Database schema | 4h | ✓ Complete | 2026-02-27 |
| 3. API endpoints + services | 5h | ✓ Complete | 2026-02-27 |
| 4. Dashboard overview | 5h | In Progress | 2026-02-28 |
| 5. Camera detail + charts | 5h | Planned | 2026-03-01 |
| 6. Alerts + thresholds | 5h | Planned | 2026-03-02 |
| 7. Settings + notifications | 5h | Planned | 2026-03-03 |

**Total effort:** 32 hours (4-day sprint)

---

## Acceptance Criteria

### Phase Completion
- [ ] All requirements from phase plan met
- [ ] Code passes linting (`npm run lint`)
- [ ] Manual testing on localhost verified
- [ ] Documentation updated
- [ ] No regressions in prior phases

### Overall Project Success
- [ ] All 7 phases complete
- [ ] Dashboard displays 50 test cameras live
- [ ] Alerts fire within 1s of threshold breach
- [ ] Email notifications sent (configurable)
- [ ] Dark mode toggle works
- [ ] Drag-drop dashboard persists layout
- [ ] All docs reviewed and finalized

---

## Known Limitations

1. **No auth** — Local network only, no user isolation
2. **Polling latency** — 5s refresh rate (upgrade to SSE if <2s needed)
3. **In-memory gap buffer** — Lost on server restart (acceptable for local deployments)
4. **Email optional** — Non-blocking; failures logged but don't block reading ingestion
5. **No data export** — Manual SQL queries required for exports
6. **Single-region** — No multi-region replication

---

## Dependencies & Risks

| Dependency | Impact | Mitigation |
|-----------|--------|-----------|
| PostgreSQL availability | Critical (no fallback) | Local docker-compose, automated backups |
| Nodemailer SMTP server | Medium (email optional) | Graceful fallback, log to console |
| Browser localStorage | Medium (dashboard layout) | User can reset via UI, defaults provided |
| Client-side polling | Medium (adds latency) | Can upgrade to SSE/WebSocket later |

---

## Future Enhancements (Backlog)

1. **Server-Sent Events (SSE)** — Replace polling for <2s latency
2. **WebSocket** — Real-time bi-directional updates
3. **Historical data archive** — Automatic purge + S3 export
4. **ML anomaly detection** — Predict threshold breaches
5. **LDAP/Active Directory auth** — Multi-user support
6. **Grafana/Prometheus integration** — Export metrics
7. **Mobile app** — Native iOS/Android
8. **API key authentication** — Secure third-party integrations

---

## Sign-Off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Product Manager | TBD | — | Approves scope + timeline |
| Tech Lead | TBD | — | Approves architecture + tech stack |
| QA Lead | TBD | — | Responsible for test coverage |
| DevOps | TBD | — | Deployment + infrastructure |

---

## Questions & Clarifications

- [ ] Confirm 30-day data retention is sufficient (or increase to 1 year?)
- [ ] Should email be mandatory for alerts or optional?
- [ ] Is Celsius-only storage acceptable, or need Fahrenheit parity?
- [ ] Multi-region deployment in scope for Phase 2?
