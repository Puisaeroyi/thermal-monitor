# Phase 2: API Tester Page & Components

**Priority:** High | **Status:** Complete | **Effort:** Medium
**Blocked by:** Phase 1

## Overview

Build the UI: request form, response viewer, request history sidebar. Follows existing page patterns (settings page as reference).

## Context Links
- [Plan](./plan.md) | [Phase 1](./phase-01-api-proxy-route.md)
- UI reference: `src/app/settings/page.tsx`
- shadcn/ui components: `src/components/ui/`

## Requirements

### Functional
- **Request Form**: URL input, method selector (GET/POST/PUT/DELETE/PATCH), headers editor (add/remove key-value rows), body textarea, timeout input, Send button
- **Response Viewer**: Status badge (color-coded: green 2xx, yellow 3xx, red 4/5xx), response time, headers table, body display (pretty-print JSON, raw fallback), copy body button
- **Request History**: localStorage-persisted list of past requests (max 50), click to re-load into form, delete individual entries, clear all
- **Loading state**: Disable Send button + show spinner during request

### Non-Functional
- Dark mode support (existing theme system)
- Responsive layout (stack on mobile)
- Each component file <200 lines

## Architecture

```
/api-tester/page.tsx (Client)
  ├─ RequestForm
  │   ├─ URL input + Method Select
  │   ├─ Headers editor (dynamic key-value rows)
  │   ├─ Body textarea (shown for POST/PUT/PATCH)
  │   ├─ Timeout input
  │   └─ Send button
  ├─ ResponseViewer
  │   ├─ Status badge + duration
  │   ├─ Response headers (collapsible)
  │   └─ Response body (pre-formatted)
  └─ RequestHistory (sidebar)
      ├─ List of past requests
      └─ Click to reload, delete, clear all
```

## Related Code Files

**Create:**
- `src/app/api-tester/page.tsx` — Main page layout, state management, fetch logic
- `src/components/api-tester/request-form.tsx` — Request input form
- `src/components/api-tester/response-viewer.tsx` — Response display panel
- `src/components/api-tester/request-history.tsx` — History sidebar
- `src/hooks/use-request-history.ts` — localStorage hook for history persistence

**Reuse (existing):**
- `Button`, `Card`, `Input`, `Select`, `Badge`, `Tabs` from `src/components/ui/`

## Implementation Steps

### 2.1 Create `use-request-history` hook
1. State: `HistoryEntry[]` loaded from localStorage key `"api-tester-history"`
2. Interface: `{ url, method, headers, body, timestamp, status?, duration? }`
3. Methods: `addEntry(entry)`, `removeEntry(index)`, `clearAll()`, `loadEntry(index) → entry`
4. Max 50 entries, FIFO eviction

### 2.2 Create `request-form` component
1. Props: `onSubmit(request)`, `loading`, `initialValues?`
2. URL input (required, placeholder: "http://192.168.1.100/api/status")
3. Method select: GET (default), POST, PUT, DELETE, PATCH
4. Headers: dynamic rows with Add/Remove buttons, key + value inputs
5. Body: textarea, only visible when method is POST/PUT/PATCH
6. Timeout: number input, default 10000
7. Send button: disabled when loading, shows spinner

### 2.3 Create `response-viewer` component
1. Props: `response: ProxyResponse | null`, `error?: string`
2. Show nothing when response is null (initial state)
3. Status badge: green for 2xx, yellow for 3xx, red for 4xx/5xx
4. Duration display in ms
5. Headers: collapsible section, key-value table
6. Body: try JSON.parse + pretty-print, fallback to raw text in `<pre>`
7. Copy button for response body

### 2.4 Create `request-history` component
1. Props: `history: HistoryEntry[]`, `onSelect(entry)`, `onDelete(index)`, `onClear()`
2. List of entries: method badge + truncated URL + timestamp
3. Click entry → populate form
4. Delete button per entry, Clear All button

### 2.5 Create `api-tester/page.tsx`
1. `"use client"` — uses hooks and state
2. State: `response`, `loading`, `error`
3. Wire up: RequestForm → POST /api/proxy → ResponseViewer
4. Wire up: RequestHistory ↔ RequestForm (load saved requests)
5. Layout: two-column on desktop (form+response left, history right), stacked on mobile

## Types

```typescript
// Used across components
interface ProxyRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

interface ProxyResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
  error?: string;
}

interface HistoryEntry extends ProxyRequest {
  timestamp: string;   // ISO string
  status?: number;     // Response status (if successful)
  duration?: number;   // Response time (if successful)
}
```

## Todo
- [x] Create use-request-history hook
- [x] Create request-form component
- [x] Create response-viewer component
- [x] Create request-history component
- [x] Create api-tester page with layout
- [x] Wire up form → proxy → response flow
- [x] Wire up history load/save

## Success Criteria
- Can enter URL, method, headers, body and send request
- Response displays with status, headers, formatted body, duration
- History persists across page refreshes (localStorage)
- Click history entry re-loads it into form
- Dark mode works correctly
- All files <200 lines
