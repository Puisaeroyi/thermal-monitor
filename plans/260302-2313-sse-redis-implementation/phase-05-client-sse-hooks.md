# Phase 5: Client SSE Hooks (Replace Polling)

**Priority:** High | **Effort:** Medium | **Status:** Complete

## Overview

Replace polling hooks with SSE-based hooks using `EventSource`. Keep polling as fallback if SSE connection fails.

## Implementation Steps

### 1. Create SSE hook

**File:** `src/hooks/use-sse.ts`

Generic hook that connects to `/api/sse` and dispatches events:

```typescript
// Manages single shared EventSource connection
// Returns event listeners registration
// Auto-reconnects on error (EventSource does this natively)
// Falls back to null if SSE unavailable

export function useSSE() {
  const [source, setSource] = useState<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/sse");
    setSource(es);
    es.onerror = () => { /* EventSource auto-reconnects */ };
    return () => es.close();
  }, []);

  return source;
}
```

### 2. Rewrite `use-cameras.ts`

Replace `usePolling("/api/readings/latest", 2000)` with SSE listener:

```typescript
export function useCameras() {
  const [cameras, setCameras] = useState<CameraReading[]>([]);
  const source = useSSE();

  useEffect(() => {
    if (!source) return;

    const handler = (e: MessageEvent) => {
      setCameras(JSON.parse(e.data));
    };

    source.addEventListener("readings", handler);
    return () => source.removeEventListener("readings", handler);
  }, [source]);

  // Keep thresholds fetch as-is (one-time on mount)
  // ...
}
```

**Fallback:** If `source` is null (SSE failed), fall back to `usePolling` with 5s interval.

### 3. Rewrite `use-alerts.ts`

Replace 10s polling with SSE `alert` events:

```typescript
// Listen for "alert" events from SSE
// Still fetch full alert list on mount for initial state
// On each SSE alert event, prepend to list + show toast
```

### 4. Update `use-readings.ts` (incremental via SSE)

For camera detail pages, keep the initial historical fetch. But instead of polling for incremental updates, listen to SSE `readings` events and filter by cameraId:

```typescript
// Initial: fetch historical readings (unchanged)
// Incremental: SSE "readings" event → extract matching cameraId → append
```

### 5. Remove `use-polling.ts` dependency from main hooks

After SSE migration, `use-polling.ts` becomes fallback-only. Main hooks use SSE as primary transport.

## Files to Create

- `src/hooks/use-sse.ts`

## Files to Modify

- `src/hooks/use-cameras.ts` — SSE primary, polling fallback
- `src/hooks/use-alerts.ts` — SSE primary, polling fallback
- `src/hooks/use-readings.ts` — SSE for incremental updates

## Files to Keep (fallback)

- `src/hooks/use-polling.ts` — Retained as fallback

## Success Criteria

- Dashboard updates within 1s of reading ingestion (vs 2s polling)
- Alert toast appears within 1s of threshold breach
- Network tab shows single SSE connection instead of repeated fetches
- Fallback to polling if EventSource constructor fails
