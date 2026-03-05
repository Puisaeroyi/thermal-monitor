# API Tester Page — Implementation Plan

**Goal:** In-app Postman-like API tester for exploring camera HTTP APIs.
**Status:** Complete
**Branch:** `feat/api-tester`

---

## Overview

Add a dedicated `/api-tester` page with server-side proxy to test external camera APIs directly from the dashboard. Browser cannot hit camera IPs directly (CORS/mixed content), so all requests proxy through a Next.js API route.

## Architecture

```
Browser (API Tester UI)
  │
  ├─ POST /api/proxy
  │   body: { url, method, headers, body, timeout }
  │
  └─ Next.js Server
      └─ fetch(url, { method, headers, body })
          └─ Camera HTTP API (192.168.x.x)
              └─ Response → { status, statusText, headers, body, duration }
```

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | API Proxy Route | Complete | [phase-01](./phase-01-api-proxy-route.md) |
| 2 | API Tester Page & Components | Complete | [phase-02](./phase-02-api-tester-page.md) |
| 3 | Navigation & Integration | Complete | [phase-03](./phase-03-navigation-integration.md) |

## Files to Create/Modify

**Create:**
- `src/app/api/proxy/route.ts` — Server-side HTTP proxy
- `src/app/api-tester/page.tsx` — Main page
- `src/components/api-tester/request-form.tsx` — URL, method, headers, body form
- `src/components/api-tester/response-viewer.tsx` — Response display
- `src/components/api-tester/request-history.tsx` — Saved request history
- `src/hooks/use-request-history.ts` — localStorage persistence hook

**Modify:**
- `src/components/layout/sidebar-nav.tsx` — Add API Tester nav link

## Estimated LOC: ~450-550 across 7 files
