---
phase: 1
title: "Project Setup"
status: pending
priority: P1
effort: 3h
---

# Phase 1 — Project Setup

## Context Links
- [Plan Overview](./plan.md)
- Next.js App Router: https://nextjs.org/docs/app
- shadcn/ui: https://ui.shadcn.com/docs/installation/next
- Prisma: https://www.prisma.io/docs/getting-started

## Overview
Scaffold the Next.js project with TypeScript, configure Tailwind CSS + shadcn/ui, initialize Prisma with PostgreSQL, and establish the directory structure.

## Requirements

### Functional
- Next.js 14 App Router project with TypeScript strict mode
- PostgreSQL connection via Prisma
- shadcn/ui component library installed
- Recharts installed
- Nodemailer installed
- Development seed scripts runnable

### Non-Functional
- All files <200 lines, kebab-case naming
- ESLint + Prettier configured
- Environment variables via `.env.local`

## Architecture — Directory Structure

```
thermal/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout with sidebar nav
│   │   ├── page.tsx                      # Dashboard overview (redirect or main)
│   │   ├── globals.css                   # Tailwind directives + shadcn theme
│   │   ├── dashboard/
│   │   │   └── page.tsx                  # Camera grid overview
│   │   ├── cameras/
│   │   │   ├── page.tsx                  # Camera management list
│   │   │   └── [cameraId]/
│   │   │       └── page.tsx              # Single camera detail + charts
│   │   ├── comparison/
│   │   │   └── page.tsx                  # Multi-camera comparison
│   │   ├── alerts/
│   │   │   └── page.tsx                  # Alert history
│   │   ├── settings/
│   │   │   └── page.tsx                  # Threshold + email config
│   │   └── api/
│   │       ├── cameras/
│   │       │   ├── route.ts              # GET list, POST create
│   │       │   └── [cameraId]/
│   │       │       └── route.ts          # GET, PUT, DELETE single
│   │       ├── readings/
│   │       │   ├── route.ts              # POST ingest, GET query
│   │       │   └── latest/
│   │       │       └── route.ts          # GET latest per camera
│   │       ├── thresholds/
│   │       │   ├── temperature/
│   │       │   │   ├── route.ts          # GET, POST
│   │       │   │   └── [id]/
│   │       │   │       └── route.ts      # PUT, DELETE
│   │       │   └── gap/
│   │       │       ├── route.ts          # GET, POST
│   │       │       └── [id]/
│   │       │           └── route.ts      # PUT, DELETE
│   │       ├── alerts/
│   │       │   ├── route.ts              # GET list with filters
│   │       │   └── [id]/
│   │       │       └── acknowledge/
│   │       │           └── route.ts      # POST acknowledge
│   │       └── settings/
│   │           └── email/
│   │               └── route.ts          # GET, PUT email config
│   ├── components/
│   │   ├── ui/                           # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── sidebar-nav.tsx
│   │   │   └── header.tsx
│   │   ├── dashboard/
│   │   │   ├── camera-grid.tsx
│   │   │   ├── camera-card.tsx
│   │   │   └── status-summary.tsx
│   │   ├── charts/
│   │   │   ├── temperature-line-chart.tsx
│   │   │   ├── comparison-chart.tsx
│   │   │   ├── gap-bar-chart.tsx
│   │   │   └── daily-summary-chart.tsx
│   │   ├── alerts/
│   │   │   ├── alert-list.tsx
│   │   │   ├── alert-badge.tsx
│   │   │   └── alert-notification-toast.tsx
│   │   └── settings/
│   │       ├── temperature-threshold-form.tsx
│   │       ├── gap-threshold-form.tsx
│   │       └── email-config-form.tsx
│   ├── lib/
│   │   ├── prisma.ts                     # Singleton Prisma client
│   │   ├── utils.ts                      # General utilities (cn, etc.)
│   │   └── constants.ts                  # App-wide constants
│   ├── services/
│   │   ├── camera-service.ts
│   │   ├── reading-service.ts
│   │   ├── threshold-service.ts
│   │   ├── gap-detection-service.ts
│   │   ├── alert-service.ts
│   │   └── email-service.ts
│   ├── hooks/
│   │   ├── use-polling.ts                # Generic polling hook
│   │   ├── use-cameras.ts
│   │   ├── use-readings.ts
│   │   └── use-alerts.ts
│   └── types/
│       ├── camera.ts
│       ├── reading.ts
│       ├── threshold.ts
│       └── alert.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed/
│       ├── seed.ts                       # Entry point
│       ├── camera-seed-data.ts           # 50 camera definitions
│       └── reading-generator.ts          # Batch + live seed modes
├── scripts/
│   └── seed-live.ts                      # Live mode seeder (continuous)
├── .env.local
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## Related Code Files
- Create: all files listed above (scaffolded, not fully implemented)
- Key config: `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `.env.example`

## Implementation Steps

1. **Initialize Next.js project**
   ```bash
   npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
   ```

2. **Configure TypeScript strict mode** in `tsconfig.json`
   - Enable `strict: true`, `noUncheckedIndexedAccess: true`

3. **Install dependencies**
   ```bash
   npm install prisma @prisma/client recharts nodemailer date-fns
   npm install -D @types/nodemailer tsx
   ```

4. **Initialize Prisma**
   ```bash
   npx prisma init --datasource-provider postgresql
   ```

5. **Install shadcn/ui**
   ```bash
   npx shadcn@latest init
   ```
   Install components: `button`, `card`, `input`, `label`, `select`, `table`, `tabs`, `badge`, `toast`, `dialog`, `switch`, `separator`, `dropdown-menu`, `sheet`

6. **Create `.env.example`**
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/thermal"
   SMTP_HOST=""
   SMTP_PORT="587"
   SMTP_USER=""
   SMTP_PASS=""
   SMTP_FROM=""
   ALERT_EMAIL_TO=""
   ```

7. **Create `src/lib/prisma.ts`** — Prisma singleton (prevent hot-reload leaks)

8. **Create `src/lib/utils.ts`** — `cn()` helper (from shadcn), `celsiusToFahrenheit()`, `formatTimestamp()`

9. **Create `src/lib/constants.ts`** — polling interval, default thresholds, max chart points

10. **Create type definition files** in `src/types/` — interfaces for Camera, Reading, Threshold, Alert

11. **Create layout** `src/app/layout.tsx` with sidebar navigation

12. **Create placeholder pages** for each route (dashboard, cameras, alerts, settings, comparison)

13. **Verify dev server runs** — `npm run dev` compiles without errors

## Todo List
- [ ] Scaffold Next.js project
- [ ] Install all dependencies
- [ ] Initialize Prisma
- [ ] Install shadcn/ui + components
- [ ] Create directory structure
- [ ] Create `.env.example` and `.env.local`
- [ ] Create Prisma singleton
- [ ] Create utility functions
- [ ] Create type definitions
- [ ] Create root layout with sidebar
- [ ] Create placeholder pages
- [ ] Verify compilation

## Success Criteria
- `npm run dev` starts without errors
- All placeholder pages render
- Prisma can connect to PostgreSQL
- shadcn/ui components render correctly
- Directory structure matches spec

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| PostgreSQL not running | Blocks Phase 2+ | Document setup in README, provide docker-compose option |
| shadcn/ui version conflicts | Low | Pin versions in package.json |
| Node version mismatch | Medium | Specify in package.json engines field |
