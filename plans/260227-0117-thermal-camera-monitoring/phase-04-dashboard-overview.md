---
phase: 4
title: "Dashboard Overview"
status: pending
priority: P1
effort: 5h
depends_on: [3]
---

# Phase 4 — Dashboard Overview

## Context Links
- [Plan Overview](./plan.md)
- [Phase 1 — Directory Structure](./phase-01-project-setup.md)
- [Phase 3 — API Endpoints](./phase-03-api-endpoints.md)
- shadcn/ui Card: https://ui.shadcn.com/docs/components/card
- Recharts: https://recharts.org/en-US/api

## Overview
Build the main dashboard showing a grid of all 50 camera cards with real-time temperature data, color-coded by status and threshold proximity. Includes layout shell with sidebar navigation.

## Requirements

### Functional
- Sidebar navigation: Dashboard, Cameras, Comparison, Alerts, Settings
- Camera grid: displays all cameras as cards (responsive grid)
- Each card shows: camera name, location, current temperature (C + F), last updated timestamp, status indicator
- Color coding: green (normal), yellow (approaching threshold), red (threshold breached), gray (inactive/no data)
- Status summary bar: total cameras, active, inactive, in-alert count
- Auto-refresh every 5 seconds via polling
- Click card → navigate to camera detail page

### Non-Functional
- Grid renders 50 cards without jank
- Polling doesn't cause full page re-render (use React state, not router refresh)
- Responsive: 4 columns on desktop, 2 on tablet, 1 on mobile
- Color transitions smooth (CSS transition on background-color)

## Architecture

### Component Tree
```
layout.tsx
├── sidebar-nav.tsx          # Left sidebar, fixed
├── header.tsx               # Top bar with alert badge + unit toggle
└── dashboard/page.tsx
    ├── status-summary.tsx   # Summary bar (counts)
    └── camera-grid.tsx      # Grid container
        └── camera-card.tsx  # Individual card (x50)
```

### Data Flow
```
dashboard/page.tsx (client component)
  → usePolling('/api/readings/latest', 5000)
  → receives: { cameraId, name, location, status, celsius, timestamp }[]
  → passes to <CameraGrid cameras={data} />
    → maps to <CameraCard /> for each camera
```

### Color Logic (in `camera-card.tsx`)
```typescript
function getCardColor(celsius: number, thresholds: Threshold[]): string {
  // Check if any threshold breached → red
  // Check if within 10% of any threshold → yellow
  // No data in last 30s → gray
  // Otherwise → green
}
```

Thresholds fetched once on page load (not every poll) and cached in state.

### Polling Hook (`src/hooks/use-polling.ts`)
```typescript
function usePolling<T>(url: string, intervalMs: number): {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}
```
- Uses `useEffect` + `setInterval`
- Fetches immediately on mount, then every `intervalMs`
- Aborts in-flight request on unmount
- Returns stale data while refreshing (no loading flash)

## Related Code Files

### Create
- `src/components/layout/sidebar-nav.tsx` — navigation sidebar
- `src/components/layout/header.tsx` — top header with alert badge
- `src/components/dashboard/camera-grid.tsx` — grid layout
- `src/components/dashboard/camera-card.tsx` — single camera card
- `src/components/dashboard/status-summary.tsx` — summary counts bar
- `src/hooks/use-polling.ts` — generic polling hook
- `src/hooks/use-cameras.ts` — camera data hook (wraps usePolling)
- `src/lib/temperature-utils.ts` — `celsiusToFahrenheit`, color logic, formatting

### Modify
- `src/app/layout.tsx` — add sidebar + header
- `src/app/dashboard/page.tsx` — implement dashboard
- `src/app/page.tsx` — redirect to /dashboard

## Implementation Steps

1. **Create temperature utilities** (`src/lib/temperature-utils.ts`)
   - `celsiusToFahrenheit(c: number): number` — `c * 9/5 + 32`, round to 1 decimal
   - `formatTemperature(celsius: number, unit: 'C' | 'F'): string`
   - `getTemperatureColor(celsius: number, thresholds): 'normal' | 'warning' | 'danger' | 'inactive'`
   - `getTimeSince(timestamp: Date): string` — "5s ago", "2m ago"

2. **Create polling hook** (`src/hooks/use-polling.ts`)
   - Generic `usePolling<T>(url, interval, options?)`
   - Options: `enabled` (boolean), `onError` callback
   - Uses `AbortController` for cleanup
   - Returns `{ data, error, isLoading, lastUpdated }`

3. **Create sidebar navigation** (`src/components/layout/sidebar-nav.tsx`)
   - Links: Dashboard, Cameras, Comparison, Alerts, Settings
   - Active state based on `usePathname()`
   - Collapsible on mobile (sheet/drawer)
   - Show unacknowledged alert count badge on Alerts link

4. **Create header** (`src/components/layout/header.tsx`)
   - App title: "Thermal Monitor"
   - Temperature unit toggle (C/F) — store in localStorage, context provider
   - Alert notification bell with unacknowledged count
   - Last updated timestamp

5. **Update root layout** (`src/app/layout.tsx`)
   - Wrap with temperature unit context provider
   - Sidebar on left, main content area on right
   - Responsive: sidebar as drawer on mobile

6. **Create status summary** (`src/components/dashboard/status-summary.tsx`)
   - Cards row: Total Cameras | Active | Inactive | Alerts Active
   - Derive from camera data array

7. **Create camera card** (`src/components/dashboard/camera-card.tsx`)
   - Props: `camera` object (name, location, cameraId, celsius, timestamp, status)
   - Display: name, location, large temperature text, time since last reading
   - Background color based on threshold evaluation
   - Click handler: `router.push(/cameras/${cameraId})`
   - Subtle pulse animation when in alert state

8. **Create camera grid** (`src/components/dashboard/camera-grid.tsx`)
   - CSS Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
   - Optional sort: by name, by temperature, by status
   - Optional filter: text search on name/location

9. **Implement dashboard page** (`src/app/dashboard/page.tsx`)
   - Client component (`"use client"`)
   - `usePolling('/api/readings/latest', 5000)` for readings
   - Fetch thresholds once on mount
   - Render `<StatusSummary>` + `<CameraGrid>`

10. **Redirect root to dashboard** (`src/app/page.tsx`)
    - `redirect('/dashboard')` from `next/navigation`

## Todo List
- [ ] Create temperature utility functions
- [ ] Create usePolling hook
- [ ] Create sidebar navigation
- [ ] Create header with unit toggle + alert badge
- [ ] Update root layout
- [ ] Create status summary component
- [ ] Create camera card component with color coding
- [ ] Create camera grid component
- [ ] Implement dashboard page with polling
- [ ] Set up root redirect to /dashboard
- [ ] Test with 50 cameras (visual check)
- [ ] Test responsive layout (mobile/tablet/desktop)

## Success Criteria
- Dashboard loads and shows 50 camera cards in a grid
- Cards update every 5s without full page refresh
- Color coding correctly reflects threshold proximity
- Temperature displays in both C and F (toggle works)
- Navigation between pages works
- Responsive layout works on all breakpoints
- Status summary shows correct counts
- Click on card navigates to camera detail

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| 50 cards re-rendering every 5s | Medium | React.memo on CameraCard, compare prev/next data |
| Polling overlap (slow response) | Low | AbortController cancels previous request |
| Threshold data stale | Low | Re-fetch thresholds on focus or every 60s |
| Layout shift on data load | Low | Skeleton loading state for cards |
