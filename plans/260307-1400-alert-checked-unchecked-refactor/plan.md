# Alert System Refactor: Checked/Unchecked Rule

## Summary
Replace time-based cooldown (Redis TTL) with state-based suppression: alerts are suppressed while an unchecked alert exists for the same threshold+camera pair. Once operator checks the alert (writes note), the system can fire again.

## Motivation
- Operators always respond to alerts (safety-critical environment)
- Time-based cooldown is arbitrary — 5min may be too short or too long
- State-based rule gives operators explicit control over alert cadence
- Removes Redis dependency for cooldown tracking (Redis still used for SSE pub/sub and threshold cache)

## Phases

| # | Phase | Status | Priority | Effort |
|---|-------|--------|----------|--------|
| 1 | Schema migration — add `thresholdId` to Alert, drop `cooldownMinutes` from thresholds | **Complete** | Critical | Small |
| 2 | Backend — replace cooldown logic with unchecked-alert check | **Complete** | Critical | Small |
| 3 | Frontend — remove cooldown UI, update threshold forms/lists | **Complete** | High | Small |
| 4 | Cleanup — remove cooldown-manager, constants, validation, types | **Complete** | Medium | Small |
| 5 | Documentation & README update | **Complete** | Low | Small |

## Key Dependencies
- Phase 2 depends on Phase 1 (needs `thresholdId` column)
- Phase 3 can run in parallel with Phase 2
- Phase 4 depends on Phase 2 completion
- Phase 5 depends on all phases

## Risk Assessment
- **Low risk**: Schema change is additive (new column) + removal of unused fields
- **No data loss**: Existing alerts unaffected; old cooldown keys in Redis expire naturally
- **Rollback**: Revert migration + restore cooldown-manager if needed
