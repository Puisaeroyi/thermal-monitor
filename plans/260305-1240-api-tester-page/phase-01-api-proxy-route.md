# Phase 1: API Proxy Route

**Priority:** High | **Status:** Complete | **Effort:** Small

## Overview

Server-side proxy endpoint that forwards HTTP requests to external camera APIs, avoiding CORS/mixed-content issues.

## Context Links
- [Plan](./plan.md)
- [Code Standards](../../docs/code-standards.md)
- API route pattern: `src/app/api/cameras/route.ts`

## Requirements

### Functional
- Accept URL, method (GET/POST/PUT/DELETE/PATCH), headers (key-value), body (raw string), timeout (ms)
- Forward request to target URL using `fetch()`
- Return response status, statusText, headers, body, and request duration (ms)
- Support JSON and non-JSON responses

### Non-Functional
- Timeout default: 10s, max: 30s
- Restrict to private IP ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x) + localhost — since app is local-network only
- No auth needed (matches existing app pattern)

## Architecture

```
POST /api/proxy
Request: {
  url: string,          // Target URL (e.g., "http://192.168.1.100/api/status")
  method: "GET"|"POST"|"PUT"|"DELETE"|"PATCH",
  headers?: Record<string, string>,
  body?: string,        // Raw body string
  timeout?: number      // ms, default 10000, max 30000
}

Response: {
  status: number,       // HTTP status code
  statusText: string,
  headers: Record<string, string>,
  body: string,         // Raw response body
  duration: number,     // Request time in ms
  error?: string        // Only if request failed (network error, timeout)
}
```

## Related Code Files
- Create: `src/app/api/proxy/route.ts`
- Reference: `src/app/api/cameras/route.ts` (route pattern)
- Reference: `src/lib/validate.ts` (validation pattern)

## Implementation Steps

1. Create `src/app/api/proxy/route.ts`
2. Implement POST handler:
   - Parse & validate request body (url required, method defaults to GET)
   - Validate URL is private IP range or localhost
   - Execute `fetch()` with AbortController for timeout
   - Measure duration with `performance.now()`
   - Return structured response with status, headers, body, duration
3. Handle errors: timeout, network failure, invalid URL, DNS resolution failure

## Todo
- [x] Create proxy route file
- [x] Implement URL validation (private IP restriction)
- [x] Implement fetch with timeout via AbortController
- [x] Return structured response with duration
- [x] Error handling for network/timeout failures

## Success Criteria
- Can proxy GET/POST requests to local network IPs
- Returns response body, headers, status, and duration
- Rejects requests to public IPs
- Times out after configured duration
