# Thermal Monitor

Real-time thermal camera monitoring dashboard. Built with Next.js 16, React 19, PostgreSQL, Prisma 7, and Recharts. Monitor 40-50 cameras at 5-second intervals with real-time alerts and temperature/gap threshold evaluation.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- npm

### Setup

```bash
# Install dependencies
npm install

# Create .env.local with DATABASE_URL
# Example: DATABASE_URL="postgresql://user:password@localhost:5432/thermal_monitor"

# Initialize database
npm run db:reset        # Creates schema + indexes
npm run db:seed         # Loads sample data (24h)
npm run db:seed-live    # Generates live streaming data

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view dashboard.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start dev server (localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | Check code style |
| `npm run db:seed` | Seed DB with 24h sample data |
| `npm run db:seed-live` | Stream live test data |
| `npm run db:reset` | Wipe + recreate schema |
| `npm run db:studio` | Open Prisma Studio GUI |

## Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | Next.js 16, React 19, TypeScript |
| **UI** | Tailwind CSS 4, shadcn/ui, Lucide icons |
| **Charts** | Recharts 3.7 |
| **Database** | PostgreSQL + Prisma 7.4 |
| **Email** | Nodemailer 8 |
| **Theme** | next-themes (light/dark) |

## Project Structure

```
src/
├── app/               # Next.js pages + API routes
│   ├── api/          # REST endpoints
│   ├── dashboard/    # Drag-drop monitoring layout
│   ├── cameras/      # List + detail pages
│   ├── alerts/       # Alert list + filtering
│   ├── comparison/   # Multi-camera charts
│   ├── settings/     # Threshold + group mgmt
│   └── layout.tsx    # Root layout
├── components/        # React components by domain
│   ├── dashboard/    # Panels, cards, palette
│   ├── cameras/      # Forms, table, headers
│   ├── alerts/       # Badge, filters, list
│   ├── charts/       # Line, comparison, gap
│   ├── settings/     # Threshold, group forms
│   ├── layout/       # Header, sidebar, theme
│   └── ui/           # shadcn primitives
├── hooks/            # Custom React hooks
├── services/         # Business logic + DB access
├── lib/              # Utilities (Prisma, validation)
└── types/            # TypeScript interfaces

prisma/
├── schema.prisma     # 6 models (Camera, Group, Reading, etc)
├── migrations/       # SQL migrations
└── seed/             # Seed data + generators
```

## Database Models

**Camera** — Device identifier, location, status, group membership
**Group** — Organize cameras (e.g., "Warehouse A", color-coded)
**Reading** — Temperature samples (cameraId + timestamp, 600 rows/min at 5s interval)
**TemperatureThreshold** — Min/max bounds with three scope levels: global, camera-specific, or group-scoped. Includes cooldown period and email notify.
**GapThreshold** — Temperature change rate (RISE/DROP/BOTH) over interval with same scope levels: global, camera-specific, or group-scoped.
**Alert** — Fired when threshold breached, can be acknowledged

See `docs/system-architecture.md` for schema diagram.

## Key Features

- **Live Dashboard** — Drag-drop customizable panels. Reorganize at runtime, persisted in localStorage.
- **Camera Monitoring** — Real-time temperature with color-coded status (green/yellow/red).
- **Alert System** — Automatic alerts on threshold breach + manual acknowledge. Email integration.
- **Temperature Charts** — Line charts with time range selector for deep dives.
- **Gap Detection** — Detect rapid temperature swings (e.g., 10°C rise in 5 min).
- **Multi-Camera Comparison** — Side-by-side temperature trends.
- **Threshold Management** — Global, per-camera, or per-group threshold limits. Configurable cooldown to prevent spam.
- **Group Organization** — Color-coded camera groups for visual sorting.
- **Dark Mode** — Full light/dark support with system preference detection.

## API Overview

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/cameras` | List all cameras |
| POST | `/api/cameras` | Create camera |
| GET | `/api/cameras/[id]` | Get single camera |
| PUT | `/api/cameras/[id]` | Update camera |
| DELETE | `/api/cameras/[id]` | Delete camera |
| GET | `/api/readings/latest` | Latest reading per camera (polling) |
| POST | `/api/readings` | Bulk ingest readings + evaluate alerts |
| GET | `/api/thresholds/temperature` | List temp thresholds |
| POST | `/api/thresholds/temperature` | Create temp threshold |
| GET/PUT/DELETE | `/api/thresholds/temperature/[id]` | Update/delete threshold |
| GET | `/api/thresholds/gap` | List gap thresholds |
| POST | `/api/thresholds/gap` | Create gap threshold |
| GET/PUT/DELETE | `/api/thresholds/gap/[id]` | Update/delete threshold |
| GET | `/api/alerts` | List alerts (with filters) |
| PUT | `/api/alerts/[id]/acknowledge` | Mark alert as read |
| GET | `/api/groups` | List groups |
| POST | `/api/groups` | Create group |
| PUT/DELETE | `/api/groups/[id]` | Update/delete group |

Full request/response specs: `docs/api-docs.md`

## Polling Architecture

- Dashboard polls `/api/readings/latest` every 5 seconds for live updates
- No WebSocket — simplified deployment, works behind any proxy
- Upgrade to Server-Sent Events (SSE) or WebSocket if needed
- Graceful error handling: stale data shown if network fails

## Alert Evaluation

Runs **synchronously during reading ingestion**:
1. Filter applicable thresholds by scope: global (no camera/group), camera-specific, or group-scoped (if camera belongs to group)
2. Temperature threshold breach? Create `TEMPERATURE` alert
3. Gap threshold breach (e.g., 10°C/5min)? Create `GAP` alert
4. Cooldown active? Skip if already alerted in last N minutes
5. Email notify? Queue via Nodemailer (best-effort, non-blocking)

In-memory ring buffer per camera tracks historical readings for gap detection—no extra DB queries. Threshold scope ensures only relevant rules are evaluated per camera.

## Development Workflow

1. **Read Docs** — Start with `docs/project-overview-pdr.md` and `docs/codebase-summary.md`
2. **Understand Code Standards** — See `docs/code-standards.md` for patterns
3. **Review Architecture** — See `docs/system-architecture.md` for data flows
4. **Make Changes** — Follow kebab-case naming, keep files <200 lines, use services for DB
5. **Run Tests** — Lint before commit: `npm run lint`
6. **Update Docs** — Reflect any API or feature changes

## Deployment

See `docs/deployment-guide.md` for PostgreSQL setup, environment variables, and production checklist.

## Notes

- No authentication — designed for local/on-premise network only
- Stores only Celsius; converts to Fahrenheit on frontend
- Composite index on `(camera_id, timestamp)` critical for 600 rows/min at scale
- Graceful alert notification fallback if email unavailable

## Documentation

- `docs/project-overview-pdr.md` — Requirements, scope, success metrics
- `docs/codebase-summary.md` — File-by-file code guide
- `docs/code-standards.md` — Naming, patterns, conventions
- `docs/system-architecture.md` — Diagrams, data flows, component relationships
- `docs/project-roadmap.md` — Phases, timeline, milestones
- `docs/deployment-guide.md` — Setup, environment, production checklist

## License

MIT
