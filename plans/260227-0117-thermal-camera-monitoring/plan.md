---
title: "Thermal Camera Monitoring Web Application"
description: "Real-time thermal camera monitoring dashboard with alerting for 40-50 cameras"
status: pending
priority: P1
effort: 32h
branch: main
tags: [nextjs, postgresql, prisma, recharts, shadcn, thermal, monitoring]
created: 2026-02-27
---

# Thermal Camera Monitoring — Implementation Plan

## Overview
Local/on-premise web app monitoring 40-50 thermal cameras at 5s intervals. Displays real-time dashboards, evaluates temperature/gap thresholds, fires UI + email alerts.

## Tech Stack
Next.js 14 (App Router) | TypeScript | PostgreSQL | Prisma | Recharts | shadcn/ui | Tailwind CSS | Nodemailer

## Phases

| # | Phase | Effort | Status | Deps |
|---|-------|--------|--------|------|
| 1 | [Project Setup](./phase-01-project-setup.md) | 3h | pending | — |
| 2 | [Database Schema](./phase-02-database-schema.md) | 4h | pending | 1 |
| 3 | [API Endpoints](./phase-03-api-endpoints.md) | 5h | pending | 2 |
| 4 | [Dashboard Overview](./phase-04-dashboard-overview.md) | 5h | pending | 3 |
| 5 | [Camera Detail Charts](./phase-05-camera-detail-charts.md) | 5h | pending | 3 |
| 6 | [Threshold & Alerts](./phase-06-threshold-alerts.md) | 5h | pending | 3 |
| 7 | [Settings & Notifications](./phase-07-settings-notifications.md) | 5h | pending | 6 |

Phases 4, 5, 6 can proceed in parallel after Phase 3. Phase 7 depends on 6.

## Key Dependencies
- PostgreSQL running locally (port 5432)
- Node.js 18+
- SMTP server for email alerts (optional, graceful fallback)

## Data Scale
- ~50 cameras x 5s interval = ~600 rows/min, ~315M rows/year (~21 GB)
- Composite index on (camera_id, timestamp) critical for query performance
- Store Celsius only; compute Fahrenheit on read

## Architecture Highlights
- Alert evaluation runs synchronously during ingestion (threshold check + gap buffer update)
- In-memory ring buffer per camera for gap detection (no extra DB queries)
- Polling at 5s for dashboard refresh (SSE/WebSocket upgrade path exists)
- No auth — local network only

## File Structure Convention
- kebab-case filenames, each file <200 lines
- Modular: services, utils, components split by concern
- See Phase 1 for full directory layout
