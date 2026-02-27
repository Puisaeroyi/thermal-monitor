---
phase: 5
title: "Camera Detail & Charts"
status: pending
priority: P1
effort: 5h
depends_on: [3]
---

# Phase 5 — Camera Detail & Charts

## Context Links
- [Plan Overview](./plan.md)
- [Phase 3 — API Endpoints](./phase-03-api-endpoints.md)
- [Phase 4 — Dashboard Overview](./phase-04-dashboard-overview.md)
- Recharts LineChart: https://recharts.org/en-US/api/LineChart
- Recharts BarChart: https://recharts.org/en-US/api/BarChart

## Overview
Build the single-camera detail page with real-time line chart, multi-camera comparison page, and gap detection bar chart. All charts use Recharts with animations disabled for real-time performance.

## Requirements

### Functional
- **Single camera page** (`/cameras/[cameraId]`):
  - Camera info header (name, location, status, current temp)
  - Line chart: last 15-30 min of readings (configurable)
  - Threshold lines overlaid on chart (horizontal reference lines)
  - Time range selector: 15min, 30min, 1hr, 6hr, 24hr
  - Auto-refresh chart every 5s (append new point, drop oldest if window exceeded)
- **Multi-camera comparison** (`/comparison`):
  - Select 2-5 cameras from dropdown
  - All selected cameras on same LineChart with different colors
  - Shared time axis, individual Y values
  - Same time range selector
- **Gap bar chart** (component, used on camera detail page):
  - Horizontal BarChart showing rate of change over configured windows
  - Color by severity: green (<50% of gap threshold), yellow (50-80%), red (>80%)
- **Camera management page** (`/cameras`):
  - Table listing all cameras with status, last reading, actions (edit/delete)
  - Add camera dialog

### Non-Functional
- Recharts: `isAnimationActive={false}` on all real-time charts
- Limit visible data points: 180 for 15min (1 per 5s), 360 for 30min
- Chart renders <100ms with 360 points
- Responsive chart sizing

## Architecture

### Component Tree — Camera Detail
```
cameras/[cameraId]/page.tsx
├── camera-info-header.tsx       # Name, location, status, current temp
├── time-range-selector.tsx      # Tab buttons: 15m, 30m, 1h, 6h, 24h
├── temperature-line-chart.tsx   # Main line chart with threshold overlay
└── gap-bar-chart.tsx            # Rate of change visualization
```

### Component Tree — Comparison
```
comparison/page.tsx
├── camera-selector.tsx          # Multi-select dropdown (max 5)
├── time-range-selector.tsx      # Reused
└── comparison-chart.tsx         # Multi-line chart
```

### Data Flow — Single Camera Chart
```
page.tsx (client component)
  → useReadings(cameraId, timeRange)  // custom hook
    → initial fetch: GET /api/readings?cameraId=X&from=T&limit=360
    → polling: GET /api/readings?cameraId=X&from=lastTimestamp
    → merges new readings into state, trims old entries
  → passes readings[] to <TemperatureLineChart />
```

### Chart Configuration
```typescript
// Recharts config for real-time line chart
<LineChart data={readings}>
  <XAxis dataKey="timestamp" tickFormatter={formatTime} />
  <YAxis domain={['auto', 'auto']} />
  <Line dataKey="celsius" dot={false} isAnimationActive={false} strokeWidth={2} />
  {thresholds.map(t => (
    <ReferenceLine y={t.maxCelsius} stroke="red" strokeDasharray="5 5" label={t.name} />
  ))}
  <Tooltip content={<CustomTooltip />} />
</LineChart>
```

### Readings Hook (`src/hooks/use-readings.ts`)
- Fetches initial window of data
- On subsequent polls, fetches only new readings (from > lastTimestamp)
- Merges into sorted array, trims to max window size
- Handles time range changes (re-fetch full window)

## Related Code Files

### Create
- `src/app/cameras/page.tsx` — camera management list
- `src/app/cameras/[cameraId]/page.tsx` — camera detail page
- `src/app/comparison/page.tsx` — multi-camera comparison
- `src/components/cameras/camera-info-header.tsx`
- `src/components/cameras/camera-table.tsx`
- `src/components/cameras/camera-form-dialog.tsx`
- `src/components/charts/temperature-line-chart.tsx`
- `src/components/charts/comparison-chart.tsx`
- `src/components/charts/gap-bar-chart.tsx`
- `src/components/charts/time-range-selector.tsx`
- `src/components/charts/custom-tooltip.tsx`
- `src/hooks/use-readings.ts`

### Modify
- `src/hooks/use-polling.ts` — may need `onData` callback variant for incremental updates

## Implementation Steps

1. **Create readings hook** (`src/hooks/use-readings.ts`)
   - `useReadings(cameraId: string, timeRange: TimeRange)`
   - State: `readings[]`, sorted by timestamp
   - Initial fetch: full window from API
   - Polling fetch: only `from > lastTimestamp`, merge results
   - On timeRange change: reset and re-fetch
   - Return: `{ readings, isLoading, error }`

2. **Create time range selector** (`src/components/charts/time-range-selector.tsx`)
   - Tabs/buttons: 15m, 30m, 1h, 6h, 24h
   - Props: `value`, `onChange`
   - For ranges >1h, increase polling interval to 30s (reduce load)

3. **Create custom tooltip** (`src/components/charts/custom-tooltip.tsx`)
   - Shows: timestamp (formatted), temperature in current unit (C/F)
   - Styled with shadcn Card

4. **Create temperature line chart** (`src/components/charts/temperature-line-chart.tsx`)
   - Props: `readings[]`, `thresholds[]`, `unit: 'C' | 'F'`
   - Recharts `<ResponsiveContainer>` wrapper
   - `<LineChart>` with single `<Line>` for temperature
   - `<ReferenceLine>` for each active threshold (min and max)
   - XAxis: formatted time (HH:mm:ss for short ranges, HH:mm for longer)
   - YAxis: auto domain with padding
   - `isAnimationActive={false}` on all animated elements
   - `dot={false}` to avoid rendering 360 dots

5. **Create camera info header** (`src/components/cameras/camera-info-header.tsx`)
   - Props: camera object + latest reading
   - Display: name, location, status badge, large current temp, last updated

6. **Implement camera detail page** (`src/app/cameras/[cameraId]/page.tsx`)
   - Client component
   - Fetch camera info on mount
   - `useReadings(cameraId, selectedTimeRange)`
   - Fetch thresholds for this camera (once)
   - Render: header, time range selector, line chart, gap bar chart

7. **Create gap bar chart** (`src/components/charts/gap-bar-chart.tsx`)
   - Props: `readings[]`, `gapThresholds[]`
   - Compute gaps for each configured window (5m, 10m, 15m)
   - Horizontal `<BarChart>` with bars colored by severity
   - Each bar: label = window name, value = current gap in celsius
   - Reference line at threshold value

8. **Create comparison chart** (`src/components/charts/comparison-chart.tsx`)
   - Props: `{ cameraId: string, readings: Reading[], color: string }[]`
   - Multi-line `<LineChart>` — one `<Line>` per camera
   - Shared XAxis, individual lines with legend
   - Color palette: 5 distinct, accessible colors

9. **Create camera selector** for comparison page
   - Multi-select dropdown using shadcn Select or Combobox
   - Max 5 cameras
   - Shows camera name + location

10. **Implement comparison page** (`src/app/comparison/page.tsx`)
    - Camera selector + time range selector
    - `useReadings` for each selected camera (parallel fetches)
    - Pass combined data to comparison chart

11. **Create camera management page** (`src/app/cameras/page.tsx`)
    - Table: camera_id, name, location, status, last temp, last updated, actions
    - Add camera button → dialog with form
    - Edit/delete actions per row
    - Uses `usePolling` for auto-refresh

12. **Create camera form dialog** (`src/components/cameras/camera-form-dialog.tsx`)
    - Fields: camera_id (create only), name, location, status
    - Validation: camera_id unique, name required
    - Submit: POST or PUT to /api/cameras

## Todo List
- [ ] Create useReadings hook with incremental polling
- [ ] Create time range selector component
- [ ] Create custom tooltip component
- [ ] Create temperature line chart with threshold overlays
- [ ] Create camera info header
- [ ] Implement camera detail page
- [ ] Create gap bar chart component
- [ ] Create comparison chart (multi-line)
- [ ] Create camera selector for comparison
- [ ] Implement comparison page
- [ ] Create camera table + management page
- [ ] Create camera form dialog
- [ ] Test chart with 360 data points (performance check)
- [ ] Test multi-camera comparison with 5 cameras
- [ ] Verify real-time updates (chart appends new points)

## Success Criteria
- Camera detail page shows real-time line chart updating every 5s
- Threshold lines visible on chart
- Time range selector works (15m to 24h)
- Comparison page renders up to 5 cameras on same chart
- Gap bar chart displays rate-of-change with color coding
- Chart performance: <100ms render with 360 points
- Camera management CRUD works
- All charts responsive on different screen sizes

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Recharts slow with many data points | High | Limit to 360 points max, disable animations, no dots |
| Multiple useReadings hooks = many parallel fetches | Medium | Comparison limited to 5 cameras; consider batch endpoint later |
| Chart flickering on data update | Medium | Replace array reference only when new data arrives |
| Time range > 1hr = thousands of points | Medium | Downsample: only fetch every Nth reading for large ranges |
| Timezone confusion in chart labels | Low | Always display in browser local time, store UTC |
