# Phase 5: Documentation & README Update

## Priority: Low | Effort: Small | Status: **Complete**

## Overview
Update README and project docs to reflect new alert suppression rule.

## Files to Update

### 1. `README.md`
- **Alert Evaluation section** (~line 157-167): Replace step 4 "Cooldown active? Skip if already alerted in last N minutes" with "Unchecked alert exists for same threshold+camera? Skip"
- **SSE Architecture section** (~line 145): Remove "Redis Cooldowns" bullet
- **Key Features** (~line 109): Change "Configurable cooldown to prevent spam" to "State-based suppression (checked/unchecked)"
- **Database Models** (~line 96): Remove "Includes cooldown period" from TemperatureThreshold description

### 2. `docs/system-architecture.md`
- Update alert evaluation flow diagram
- Remove cooldown references

### 3. `docs/codebase-summary.md`
- Remove cooldown-manager.ts entry
- Update alert-evaluation-service description

## Todo
- [ ] Update README alert evaluation flow
- [ ] Update README features/SSE/models descriptions
- [ ] Update system-architecture.md
- [ ] Update codebase-summary.md

## Success Criteria
- No mention of "cooldown" in docs (except historical/changelog context)
- Alert suppression rule clearly documented
