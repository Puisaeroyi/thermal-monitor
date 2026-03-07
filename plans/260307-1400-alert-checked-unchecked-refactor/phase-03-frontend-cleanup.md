# Phase 3: Frontend — Remove Cooldown UI from Threshold Forms

## Priority: High | Effort: Small | Status: **Complete**

## Overview
Remove cooldown minutes input from threshold forms, remove cooldown column from threshold lists. No other frontend changes needed — alert list already shows Checked/Unchecked status.

## Context Links
- `src/components/settings/temperature-threshold-form.tsx` — cooldown input field
- `src/components/settings/gap-threshold-form.tsx` — cooldown input field
- `src/components/settings/threshold-lists.tsx` — cooldown column in tables

## Implementation Steps

### 1. `temperature-threshold-form.tsx`
- Remove `cooldownMinutes` from form state interface and initial state
- Remove `cooldownMinutes` from edit prefill (`useEffect`)
- Remove `cooldownMinutes` from submit payload
- Remove cooldown input JSX block (Label + Input)

### 2. `gap-threshold-form.tsx`
- Same changes as above

### 3. `threshold-lists.tsx`
- Remove "Cooldown" `<TableHead>` column from temperature threshold table
- Remove `<TableCell>{t.cooldownMinutes}m</TableCell>` from temperature rows
- Remove "Cooldown" `<TableHead>` column from gap threshold table
- Remove `<TableCell>{t.cooldownMinutes}m</TableCell>` from gap rows

## Todo
- [ ] Remove cooldown from temperature threshold form (state, prefill, submit, JSX)
- [ ] Remove cooldown from gap threshold form (state, prefill, submit, JSX)
- [ ] Remove cooldown columns from threshold list tables
- [ ] Verify UI renders without errors

## Success Criteria
- No cooldown input appears in threshold create/edit forms
- No cooldown column in threshold list tables
- Existing functionality (create, edit, delete thresholds) unaffected
