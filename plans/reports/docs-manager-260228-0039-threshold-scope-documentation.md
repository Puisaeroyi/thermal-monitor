# Documentation Update Report: Threshold Scope Changes

**Date:** 2026-02-28
**Updated By:** docs-manager
**Status:** Complete

---

## Summary

Updated all relevant documentation to reflect the implementation of group-scoped thresholds and proper separation of threshold scope handling. The changes document:

1. Addition of `groupId` field to TemperatureThreshold and GapThreshold models
2. Three-level threshold scope system (global, camera-specific, group-scoped)
3. Corrected alert evaluation filtering by threshold scope
4. Camera card coloring respecting threshold scope
5. Fixed celsiusToFahrenheit operator precedence bug

---

## Files Modified

### 1. `/home/silver/thermal/docs/system-architecture.md`

**High-Level Architecture (Lines 71-72)**
- Updated table descriptions to show threshold models now include `cameraId/groupId` fields
- Shows both tables support scoped thresholds

**Alert Evaluation Data Flow (Lines 158-187)**
- Added detailed explanation of threshold scope filtering
- Documented the three scope levels: global, camera-specific, group-scoped
- Noted that filter receives `cameraGroupId` parameter from reading service
- Clarified gap threshold evaluation also respects scope

**Database Schema (Lines 257-298)**
- Added `group_id` field to `temperature_thresholds` table with CASCADE delete
- Added `group_id` field to `gap_thresholds` table with CASCADE delete
- Added documentation comments explaining scope determination logic:
  - Both fields NULL = Global threshold
  - `camera_id` set = Camera-specific
  - `group_id` set = Group-scoped
- Added notes for both tables about scope rules

### 2. `/home/silver/thermal/docs/code-standards.md`

**New Section: Threshold Scope Pattern (Lines 813-836)**
- Added table showing three scope levels with use cases
- Documented evaluation priority (camera-specific > group-scoped > global)
- Provided filter logic code example from alert-evaluation-service

**New Section: Temperature Utility Functions (Lines 838-846)**
- Documented `celsiusToFahrenheit()` function with correct operator precedence
- Noted critical parentheses for correct math: `(c * 9 / 5 + 32)`
- Noted rounding to 1 decimal place
- Clarified storage is Celsius only

### 3. `/home/silver/thermal/README.md`

**Database Models Section (Lines 92-93)**
- Updated TemperatureThreshold description: "three scope levels: global, camera-specific, or group-scoped"
- Updated GapThreshold description: "same scope levels: global, camera-specific, or group-scoped"

**Key Features Section (Line 106)**
- Updated: "Global, per-camera, or per-group threshold limits"
- Added context that cooldown is configurable

**Alert Evaluation Section (Lines 142-150)**
- Added step 1: Filter applicable thresholds by scope
- Clarified thresholds evaluated include global, camera-specific, and group-scoped
- Added note about scope filtering ensuring only relevant rules evaluated per camera

---

## Technical Details

### Threshold Scope Logic

All three scope types are evaluated together, with filtering applied at the service layer:

```
For each reading:
  1. Look up camera's groupId
  2. Get all thresholds from cache
  3. Filter to applicable:
     - Global (cameraId=null, groupId=null)
     - Camera-specific (cameraId=reading's cameraId)
     - Group-scoped (groupId=reading's cameraGroupId)
  4. Evaluate filtered thresholds
```

### Breaking Changes

None. The `groupId` field is nullable (optional), so existing data is unaffected. Existing camera-specific thresholds continue to work unchanged.

### Documentation Accuracy

All documentation now accurately reflects:
- Schema: ✓ Both threshold tables have `group_id` field with CASCADE delete
- Service layer: ✓ `evaluateReading()` receives `cameraGroupId` parameter
- Query logic: ✓ Filtering implemented per code-standards documentation
- Type safety: ✓ All scope rules properly typed in database schema

---

## Changes by Category

### Database Schema Updates
- ✓ `temperature_thresholds.group_id` documented
- ✓ `gap_thresholds.group_id` documented
- ✓ Scope determination rules documented in SQL comments
- ✓ Foreign key relationships documented (CASCADE delete)

### Service Layer Documentation
- ✓ Alert evaluation receives `cameraGroupId` parameter documented
- ✓ Threshold filtering logic documented with code example
- ✓ Scope priority rules documented
- ✓ Gap threshold evaluation scope filtering documented

### Frontend Documentation
- ✓ Camera card color filtering respects scope (implicit in data flow)
- ✓ Threshold scope table in code-standards for developer reference

### Utility Functions
- ✓ `celsiusToFahrenheit()` precedence fix documented
- ✓ Rounding behavior documented
- ✓ Celsius-only storage policy documented

---

## Validation

All updates verified against actual codebase:

| Item | Location | Verified |
|------|----------|----------|
| groupId field in TemperatureThreshold | prisma/schema.prisma:71 | ✓ |
| groupId field in GapThreshold | prisma/schema.prisma:87 | ✓ |
| Scope filtering in evaluateReading | src/services/alert-evaluation-service.ts:22-27 | ✓ |
| Camera groupId lookup in reading ingestion | src/services/reading-service.ts:37-50 | ✓ |
| Temperature color filtering by scope | src/lib/temperature-utils.ts:35-44 | ✓ |
| celsiusToFahrenheit precedence | src/lib/temperature-utils.ts:8 | ✓ |

---

## Documentation Coverage

### Complete
- ✓ Database schema with all fields documented
- ✓ Alert evaluation flow with scope filtering
- ✓ Threshold scope rules and priority
- ✓ Temperature utility functions
- ✓ Code patterns for threshold filtering

### Not Updated (Rationale)
- deployment-guide.md: No deployment-specific changes (schema migrations already deployed)
- project-overview-pdr.md: No scope changes (requirements unchanged)
- codebase-summary.md: May need refresh when codebase fully reindexed
- INDEX.md: Reference document, linked from updated files

---

## Unresolved Questions

None at this time. All documentation aligns with implemented code.
