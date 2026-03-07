# Phase 2: Backend — Replace Cooldown with Unchecked-Alert Check

## Priority: Critical | Effort: Small | Status: **Complete**

## Overview
Replace `cooldownManager.canAlert()` with a DB query checking for existing unchecked alerts per threshold+camera. Persist `thresholdId` when creating alerts.

## Context Links
- `src/services/alert-evaluation-service.ts` — main evaluation loop
- `src/services/alert-service.ts` — createAlert function
- `src/services/cooldown-manager.ts` — to be deleted in Phase 4

## Requirements
- If an unchecked (acknowledged=false) alert exists for the same thresholdId+cameraId → skip creating new alert
- When creating alert, persist `thresholdId` to DB
- Remove all `cooldownManager` calls from evaluation service

## Architecture

```
Reading → evaluateReading()
  → For each threshold:
      → Query: SELECT 1 FROM alerts WHERE threshold_id=? AND camera_id=? AND acknowledged=false LIMIT 1
      → If exists → skip (suppressed)
      → If not exists → createAlert(with thresholdId) → email + SSE
```

## Implementation Steps

### 1. Add `hasUncheckedAlert` function to `alert-service.ts`
```typescript
/** Check if an unchecked alert exists for this threshold+camera pair. */
export async function hasUncheckedAlert(thresholdId: string, cameraId: string): Promise<boolean> {
  const count = await prisma.alert.count({
    where: { thresholdId, cameraId, acknowledged: false },
    take: 1, // early exit optimization
  });
  return count > 0;
}
```

### 2. Update `createAlert` in `alert-service.ts`
Persist `thresholdId` in the `prisma.alert.create()` data:
```typescript
data: {
  cameraId: input.cameraId,
  thresholdId: input.thresholdId ?? null,  // ADD THIS
  type: input.type as AlertType,
  message: input.message,
  celsius: input.celsius,
  thresholdValue: input.thresholdValue ?? null,
},
```

### 3. Update `alert-evaluation-service.ts`
- Remove import of `cooldownManager`
- Import `hasUncheckedAlert` from alert-service
- Replace both cooldown checks:

**Before:**
```typescript
if (!(await cooldownManager.canAlert(t.id, cameraId))) continue;
// ... createAlert ...
await cooldownManager.recordAlert(t.id, cameraId, t.cooldownMinutes);
```

**After:**
```typescript
if (await hasUncheckedAlert(t.id, cameraId)) continue;
// ... createAlert (already passes thresholdId) ...
// No recordAlert needed — the unchecked alert itself is the suppression
```

Do this for BOTH the temperature threshold loop and the gap threshold loop.

## Todo
- [ ] Add `hasUncheckedAlert()` to alert-service.ts
- [ ] Update `createAlert()` to persist thresholdId
- [ ] Replace cooldown checks in evaluation service (temperature loop)
- [ ] Replace cooldown checks in evaluation service (gap loop)
- [ ] Remove cooldownManager import from evaluation service
- [ ] Verify compilation: `npx next build` or `npx tsc --noEmit`

## Success Criteria
- Alert created with thresholdId persisted
- No new alert fires while unchecked alert exists for same threshold+camera
- After operator checks alert → next breach fires new alert
- No references to cooldownManager in evaluation service

## Performance Note
The `hasUncheckedAlert` query uses the composite index `(thresholdId, cameraId, acknowledged)` — should be sub-millisecond even with millions of alerts.
