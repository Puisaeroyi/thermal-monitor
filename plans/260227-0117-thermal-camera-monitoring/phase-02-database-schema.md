---
phase: 2
title: "Database Schema & Seeder"
status: pending
priority: P1
effort: 4h
depends_on: [1]
---

# Phase 2 — Database Schema & Seeder

## Context Links
- [Plan Overview](./plan.md)
- [Phase 1 — Project Setup](./phase-01-project-setup.md)
- Prisma schema reference: https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference

## Overview
Define the complete Prisma schema, create migrations, and build a data seeder that supports both batch mode (historical data) and live mode (continuous 5s inserts).

## Requirements

### Functional
- 5 tables: cameras, readings, temperature_thresholds, gap_thresholds, alerts
- Composite index on readings (camera_id, timestamp)
- Seeder generates 50 cameras with realistic names/locations
- Batch mode: seeds last 24h of readings (~17,280 rows/camera = ~864,000 total)
- Live mode: continuously inserts readings every 5s for all 50 cameras
- Realistic temperature patterns (base temp + sine wave + noise + occasional spikes)

### Non-Functional
- Batch inserts (1000 rows per `createMany`) for performance
- Seeder logs progress to console
- Idempotent: re-running clears old data first

## Architecture

### Prisma Schema Design

**Enums:**
- `CameraStatus`: `ACTIVE`, `INACTIVE`
- `AlertType`: `TEMPERATURE`, `GAP`
- `GapDirection`: `RISE`, `DROP`, `BOTH`

**Key decisions:**
- `readings.id` is `BigInt` autoincrement (not UUID) — 315M rows/yr, sequential inserts are faster
- `readings.celsius` is `Float` (Prisma) mapped to `real` (float4) in Postgres — sufficient precision for thermal
- `camera_id` string FK (not UUID join) — matches external camera identifiers, simpler queries
- Timestamps all `timestamptz` via `@db.Timestamptz`
- `temperature_thresholds.camera_id` nullable — null means global threshold

### Seeder Architecture

```
prisma/seed/
├── seed.ts                  # Entry: parse args, orchestrate
├── camera-seed-data.ts      # 50 camera definitions (name, location, base temp)
└── reading-generator.ts     # Temperature generation logic

scripts/
└── seed-live.ts             # Live mode: infinite loop, 5s interval
```

**Temperature generation algorithm:**
```
baseTemp + sin(timeOfDay) * dailyVariance + random(-noise, +noise) + spike
```
- Each camera has a `baseTemp` (20-80C range depending on "location")
- Daily sine wave: +/- 5C over 24h
- Random noise: +/- 1C
- Spike probability: 2% chance of +15-25C spike (triggers alerts for testing)

## Related Code Files

### Create
- `prisma/schema.prisma` — full schema
- `prisma/seed/seed.ts` — batch seeder entry point
- `prisma/seed/camera-seed-data.ts` — 50 camera definitions
- `prisma/seed/reading-generator.ts` — temperature generation
- `scripts/seed-live.ts` — live continuous seeder

### Modify
- `package.json` — add prisma seed script + seed-live script

## Implementation Steps

1. **Define Prisma schema** in `prisma/schema.prisma`
   - All 5 tables with proper types, relations, indexes
   - Use `@@index([cameraId, timestamp])` on readings
   - Map enum values to lowercase strings
   - Add `@@map` for snake_case table names

2. **Run initial migration**
   ```bash
   npx prisma migrate dev --name init
   ```

3. **Create camera seed data** (`prisma/seed/camera-seed-data.ts`)
   - Array of 50 objects: `{ cameraId: "CAM-001", name: "Furnace A - Zone 1", location: "Building A - Floor 1", baseTemp: 45 }`
   - Group cameras by logical areas: furnaces, HVAC, server rooms, cold storage, ambient
   - Each group has different base temperature ranges

4. **Create reading generator** (`prisma/seed/reading-generator.ts`)
   - Export `generateReading(camera, timestamp): number` — returns celsius
   - Export `generateReadingsBatch(camera, startTime, endTime, intervalSec): { timestamp, celsius }[]`
   - Deterministic seed per camera for reproducible data
   - Include spike logic for alert testing

5. **Create batch seeder** (`prisma/seed/seed.ts`)
   - Parse CLI args: `--hours 24` (default), `--clear` (delete existing)
   - Delete existing data if `--clear`
   - Upsert 50 cameras
   - Generate readings in batches of 1000 via `prisma.reading.createMany`
   - Create 3-4 sample temperature thresholds (global + per-camera)
   - Create 2-3 sample gap thresholds
   - Log progress: `Seeding camera 12/50... 5000/17280 readings`

6. **Create live seeder** (`scripts/seed-live.ts`)
   - Infinite loop with 5s `setTimeout`
   - Each tick: generate 1 reading per camera (50 inserts)
   - Use `createMany` for batch efficiency
   - Graceful shutdown on SIGINT
   - Log: `[12:34:56] Inserted 50 readings (avg: 42.3C)`

7. **Add package.json scripts**
   ```json
   "prisma": { "seed": "tsx prisma/seed/seed.ts" },
   "scripts": {
     "db:seed": "tsx prisma/seed/seed.ts --clear --hours 24",
     "db:seed-live": "tsx scripts/seed-live.ts",
     "db:reset": "npx prisma migrate reset --force",
     "db:studio": "npx prisma studio"
   }
   ```

8. **Verify** — run migration, seed, check via Prisma Studio

## Todo List
- [ ] Write Prisma schema with all 5 tables + enums + indexes
- [ ] Run initial migration
- [ ] Create camera seed data (50 cameras)
- [ ] Implement reading generator with realistic patterns
- [ ] Implement batch seeder
- [ ] Implement live seeder
- [ ] Add npm scripts
- [ ] Verify via Prisma Studio: cameras, readings, thresholds exist
- [ ] Verify live seeder inserts continuously

## Success Criteria
- Migration creates all tables without errors
- `npm run db:seed` populates ~864K readings in <2 minutes
- `npm run db:seed-live` inserts 50 readings every 5s continuously
- Temperature data looks realistic (no flat lines, visible patterns)
- Sample thresholds exist in DB

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Batch seed too slow | Medium | Use `createMany` with 1000-row batches, disable Prisma logging |
| BigInt serialization in JSON | Medium | Use `String(bigint)` or configure Prisma to return number |
| Live seeder drift | Low | Use `setInterval` with adjustment for execution time |
| Disk space during development | Low | Default to 24h of data (~864K rows, ~50MB) |
