# Phase 1: Schema Migration

## Priority: Critical | Effort: Small | Status: **Complete**

## Overview
Add `thresholdId` to Alert model (required for unchecked-alert lookup). Remove `cooldownMinutes` from both threshold models.

## Context Links
- Schema: `prisma/schema.prisma`
- Migration docs: Prisma 7 migrate

## Requirements
- Alert must store which threshold triggered it (for per-threshold+camera suppression query)
- Threshold models no longer need cooldownMinutes field

## Implementation Steps

### 1. Update Prisma Schema (`prisma/schema.prisma`)

**Alert model — add `thresholdId`:**
```prisma
model Alert {
  id             String    @id @default(cuid())
  cameraId       String    @map("camera_id")
  thresholdId    String?   @map("threshold_id")   // NEW
  type           AlertType
  message        String
  celsius        Float     @db.Real
  thresholdValue Float?    @map("threshold_value") @db.Real
  note           String?   @db.Text
  acknowledged   Boolean   @default(false)
  acknowledgedAt DateTime? @map("acknowledged_at") @db.Timestamptz()
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz()

  camera Camera @relation(fields: [cameraId], references: [cameraId], onDelete: Cascade)

  @@index([cameraId, createdAt])
  @@index([acknowledged])
  @@index([thresholdId, cameraId, acknowledged])  // NEW: for fast unchecked-alert lookup
  @@map("alerts")
}
```

**TemperatureThreshold — remove `cooldownMinutes`:**
Remove line: `cooldownMinutes Int @default(5) @map("cooldown_minutes")`

**GapThreshold — remove `cooldownMinutes`:**
Remove line: `cooldownMinutes Int @default(5) @map("cooldown_minutes")`

### 2. Generate & Apply Migration
```bash
npx prisma migrate dev --name add-threshold-id-remove-cooldown
```

### 3. Regenerate Prisma Client
```bash
npx prisma generate
```

## Todo
- [ ] Add `thresholdId` field to Alert model
- [ ] Add composite index `(thresholdId, cameraId, acknowledged)` for fast lookup
- [ ] Remove `cooldownMinutes` from TemperatureThreshold
- [ ] Remove `cooldownMinutes` from GapThreshold
- [ ] Run migration
- [ ] Regenerate Prisma client

## Success Criteria
- Migration applies cleanly
- `npx prisma validate` passes
- Prisma client regenerated without errors

## Notes
- `thresholdId` is nullable (String?) because old alerts won't have it — that's fine
- The new composite index is critical for performance: the unchecked-alert check runs on every reading ingestion
