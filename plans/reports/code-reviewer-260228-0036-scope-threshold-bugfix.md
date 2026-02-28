# Code Review: Scope Threshold Bug Fixes

**Date:** 2026-02-28
**Scope:** Bug fixes for group-scoped threshold evaluation and camera card coloring
**Files reviewed:** 12 (see list below)

---

## Files Reviewed

- `prisma/schema.prisma`
- `prisma/migrations/20260228003204_add_group_id_to_thresholds/migration.sql`
- `src/types/threshold.ts`
- `src/lib/validate.ts`
- `src/lib/temperature-utils.ts`
- `src/services/threshold-cache.ts`
- `src/services/alert-evaluation-service.ts`
- `src/services/reading-service.ts`
- `src/services/threshold-service.ts`
- `src/components/settings/temperature-threshold-form.tsx`
- `src/components/settings/gap-threshold-form.tsx`
- `src/components/settings/threshold-lists.tsx`
- `src/components/dashboard/camera-card.tsx`
- `src/app/settings/page.tsx`

---

## Overall Assessment

The two primary bugs are correctly fixed. The approach — adding a dedicated `groupId` column and migrating misplaced data out of `cameraId` — is the right architectural decision. The scope-filtering logic in both the evaluation service and UI is consistent and correct. Three additional bugs were found during review (one critical, two high), none related to the primary fix scope.

---

## Critical Issues

### 1. `celsiusToFahrenheit` operator precedence — completely wrong output

**File:** `src/lib/temperature-utils.ts` line 8

Current code:
```ts
return Math.round((c * 9) / 5 + 32 * 10) / 10;
```

Due to operator precedence, `32 * 10 = 320` is added before dividing by 10, so the formula becomes `(9c/5 + 320) / 10`. At 25°C this returns `36.5` instead of `77.0`. At 0°C it coincidentally returns `32` which masks the bug.

Fix:
```ts
return Math.round((c * 9 / 5 + 32) * 10) / 10;
```

This is pre-existing (not introduced in this PR) but affects all Fahrenheit display in the app. Every temperature shown in °F is wrong.

---

## High Priority

### 2. Toggle-only PUT fails with 400 — thresholds cannot be enabled/disabled

**File:** `src/app/settings/page.tsx` lines 91-107
**Related:** `src/app/api/thresholds/temperature/[id]/route.ts`, `src/lib/validate.ts`

`handleToggleTemp` and `handleToggleGap` send only `{ enabled: boolean }` to the PUT endpoint:
```ts
body: JSON.stringify({ enabled }),
```

The PUT handler calls `validateTemperatureThresholdInput` (and the gap equivalent), which requires `name` as a mandatory field and throws `ValidationError("name must be a non-empty string")` → 400. The toggle switch in the UI silently fails — the state appears to change client-side (React state not updated on error) but the DB record is never updated.

Fix (simplest): create a separate validation path for partial updates, or relax the `name` check to be optional when it's a PATCH-style partial PUT:
```ts
// In validateTemperatureThresholdInput, make name optional for updates:
if (d.name !== undefined && (typeof d.name !== 'string' || !d.name)) {
  throw new ValidationError("name must be a non-empty string");
}
```
Or add a `PATCH` route specifically for partial updates.

### 3. Threshold cache uses `any[]` — loses type safety for groupId field

**File:** `src/services/threshold-cache.ts` lines 6-7, 25, 30

```ts
private tempThresholds: any[] = [];
private gapThresholds: any[] = [];
```

The cache returns `any[]`, which means if Prisma's returned shape ever drifts (e.g. a migration changes a field name), the `groupId` check in `alert-evaluation-service.ts` (`t.groupId === cameraGroupId`) silently compares against `undefined` without a type error.

Fix:
```ts
import type { TemperatureThreshold as PrismaTemp, GapThreshold as PrismaGap } from "@/generated/prisma/client";
private tempThresholds: PrismaTemp[] = [];
private gapThresholds: PrismaGap[] = [];
async getTemperatureThresholds(): Promise<PrismaTemp[]> { ... }
async getGapThresholds(): Promise<PrismaGap[]> { ... }
```

---

## Medium Priority

### 4. `minCelsius = 0` is rejected by falsy guard in temperature threshold form

**File:** `src/components/settings/temperature-threshold-form.tsx` line 94

```ts
if (!minCelsius && !maxCelsius) {
```

`parseFloat("0")` returns `0`, which is falsy, so a threshold with `minCelsius=0` (a valid use case: alert when temperature drops to freezing) gets rejected with "At least min or max temperature is required". `maxCelsius=0` has the same issue.

Fix:
```ts
if (minCelsius === null && maxCelsius === null) {
```

### 5. `thresholds` fetched only once on mount in `useCameras` — stale after threshold changes

**File:** `src/hooks/use-cameras.ts` lines 38-51

Thresholds are fetched once on component mount with no refresh mechanism. If a user adds or changes thresholds in Settings and returns to the dashboard, camera card colors reflect stale threshold data until a page reload.

Not a blocker, but worth noting. Fix: either poll thresholds alongside readings, or add a refetch trigger. Since thresholds change rarely, a long interval (60s) or a simple cache-bust query param after settings mutations would suffice.

### 6. `GapThreshold` type duplicated across three files

**Files:**
- `src/types/threshold.ts` (canonical)
- `src/app/settings/page.tsx` (local duplicate, lines 12-25)
- `src/components/settings/threshold-lists.tsx` (local duplicate, lines 46-59)

The local duplicates have `groupId: string | null` (correct after this fix) but they exist independently of the canonical type. A future change to `src/types/threshold.ts` won't automatically propagate.

Fix: import from `@/types/threshold` in both files. The `GapThreshold` type in `threshold.ts` is already complete.

---

## Low Priority

### 7. Scope form only supports Global and Group — camera-specific scope silently falls to `all`

**File:** `src/components/settings/temperature-threshold-form.tsx`, `gap-threshold-form.tsx`

The scope `<Select>` only renders `"all"` and `"group-{id}"` options. The form state handles `"camera-{id}"` in the edit `useEffect` (line 69-70) but there is no UI to create a camera-scoped threshold. If a camera-scoped threshold exists in the DB (pre-migration or via API), it will display in the list via `getScopeName` using the raw `cameraId` value (ugly but functional). This is probably intentional scope reduction, but worth documenting.

### 8. `getTimeSince` returns `"just now"` for future timestamps

**File:** `src/lib/temperature-utils.ts` line 75

```ts
if (diffMs < 0) return "just now";
```

Clock skew between reading source and server could cause this. Not a regression from this PR.

---

## Primary Bug Fix Assessment

### Bug 1: Alert evaluation for group-scoped thresholds

**Verdict: Correctly fixed.**

The migration safely identifies misplaced group IDs by cross-referencing against the `groups` table:
```sql
WHERE "camera_id" IS NOT NULL
  AND "camera_id" IN (SELECT "id" FROM "groups");
```
This is safe — it only moves values that are confirmed to be group IDs. Legitimate camera IDs will never collide with group IDs because cameras use user-supplied string IDs and groups use `cuid()`.

The evaluation filter in `alert-evaluation-service.ts` correctly handles three mutually exclusive cases: global (both null), camera-specific, group-scoped.

One edge case: `cameraGroupMap[r.cameraId]` returns `undefined` (not `null`) when a camera ID in a reading doesn't exist in the DB. The filter `t.groupId !== null && t.groupId === undefined` evaluates to `false` (correct — no group match). Global thresholds still fire. Safe.

### Bug 2: Camera card coloring scope

**Verdict: Correctly fixed.**

`getTemperatureColor` now receives `cameraId` and `groupId` and filters thresholds by scope before evaluating color. The `CameraReading` interface carries `groupId`, `camera-card.tsx` passes both values, and `getLatestReadings` in `reading-service.ts` includes `group_id` in the raw SQL join. The data flows end-to-end correctly.

The `enabled` filter is applied inside `getTemperatureColor` (not relied on from the cache since the UI fetches all thresholds including disabled ones via the API). This is correct — the cache is server-side only.

---

## Recommended Actions

1. **[Critical]** Fix `celsiusToFahrenheit` operator precedence in `src/lib/temperature-utils.ts:8`
2. **[High]** Fix toggle PUT failure — either relax name validation for partial updates or add a PATCH route
3. **[High]** Type the threshold cache with Prisma types instead of `any[]`
4. **[Medium]** Fix `!minCelsius` falsy guard to `=== null` check in temperature-threshold-form
5. **[Medium]** Remove duplicate `GapThreshold` interface from `settings/page.tsx` and `threshold-lists.tsx`, import from `@/types/threshold`
6. **[Low]** Consider periodic threshold refresh in `useCameras` hook

---

## Unresolved Questions

- Is camera-scoped threshold creation intentionally removed from the UI, or is it deferred to a future phase? The form handles editing camera-scoped records but cannot create them.
- The `thresholds` cache TTL is 60s. With `invalidate()` called on mutations, should the on-mount fetch in `useCameras` also include disabled thresholds (for display color purposes) while the evaluation service only sees enabled ones? Currently they are split: UI fetches all, cache fetches enabled-only. This is correct but implicit.
