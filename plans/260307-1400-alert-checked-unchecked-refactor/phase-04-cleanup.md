# Phase 4: Cleanup — Remove Cooldown Artifacts

## Priority: Medium | Effort: Small | Status: **Complete**

## Overview
Delete cooldown-manager module. Remove cooldown references from types, validation, constants, and services.

## Files to Modify/Delete

| Action | File | What |
|--------|------|------|
| DELETE | `src/services/cooldown-manager.ts` | Entire file |
| EDIT | `src/lib/constants.ts` | Remove `DEFAULT_COOLDOWN_MINUTES` |
| EDIT | `src/types/threshold.ts` | Remove `cooldownMinutes` from interfaces |
| EDIT | `src/lib/validate.ts` | Remove `cooldownMinutes` from validation schemas |
| EDIT | `src/services/threshold-service.ts` | Remove `cooldownMinutes` from create/update operations |

## Implementation Steps

### 1. Delete `src/services/cooldown-manager.ts`

### 2. `src/lib/constants.ts`
Remove:
```typescript
/** Default cooldown for alerts in minutes */
export const DEFAULT_COOLDOWN_MINUTES = 5;
```

### 3. `src/types/threshold.ts`
Remove `cooldownMinutes: number;` from both TemperatureThreshold and GapThreshold interfaces.

### 4. `src/lib/validate.ts`
- Remove `cooldownMinutes` from input interfaces (~line 30, 42)
- Remove cooldownMinutes validation logic (~line 244-245)
- Remove `cooldownMinutes` from parsed output (~line 254, 291)

### 5. `src/services/threshold-service.ts`
- Remove `cooldownMinutes` from create data (~line 32, 102)
- Remove `cooldownMinutes` from update spread (~line 56-57, 133-134)

## Todo
- [ ] Delete cooldown-manager.ts
- [ ] Remove DEFAULT_COOLDOWN_MINUTES from constants
- [ ] Remove cooldownMinutes from threshold type interfaces
- [ ] Remove cooldownMinutes validation from validate.ts
- [ ] Remove cooldownMinutes from threshold-service create/update
- [ ] Verify no remaining references: `grep -r cooldown src/`
- [ ] Verify compilation passes

## Success Criteria
- Zero references to "cooldown" in src/ (except possibly comments in git history)
- `npx tsc --noEmit` passes
- `npm run lint` passes
