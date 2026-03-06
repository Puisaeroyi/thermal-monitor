# Code Review: RTSP Temperature Data Integration

**Date:** 2026-03-06
**Scope:** 9 files, RTSP collector integration feature
**Focus:** Security, logic correctness, edge cases, API contracts, performance

---

## Scope

| File | Type |
|------|------|
| `rtsp_metadata_temp_collector.py` | Modified — NULL output + HTTP POST |
| `src/lib/validate.ts` | Modified — TemperatureReadingInput + validators |
| `src/app/api/temperature-readings/route.ts` | NEW — POST ingest endpoint |
| `src/app/api/export-readings/route.ts` | NEW — GET CSV export |
| `src/components/charts/temperature-line-chart.tsx` | Modified — connectNulls={false} |
| `src/components/dashboard/camera-card.tsx` | Modified — stale indicator |
| `src/app/(dashboard)/page.tsx` | Modified — Export CSV button |
| `scripts/install-cron.sh` | NEW — cron installer |
| `scripts/test-collector.sh` | NEW — test runner |

---

## Overall Assessment

Feature is well-structured and mostly correct. Validator is solid. The main issues are: **no auth on the two new API routes** (critical for the ingest endpoint), a **silent data corruption bug** with the `celsius=0` sentinel for null readings, and a **CSV injection** vulnerability in the export. Several medium-priority logic and performance issues also noted below.

---

## Critical Issues

### 1. No Authentication on POST /api/temperature-readings

`src/app/api/temperature-readings/route.ts` — no auth check whatsoever.

**Impact:** Any unauthenticated caller can POST arbitrary readings, flip camera statuses to INACTIVE, and trigger alert evaluation. This is a write endpoint that mutates state.

The project has no middleware.ts, so there is no framework-level guard. The login route sets an `auth` cookie. This endpoint ignores it.

**Fix:** Add a shared `requireAuth(req)` guard (checking `auth` cookie or a pre-shared API key for the cron/daemon context):

```ts
// Option A: shared secret header for machine-to-machine (cron job use case)
const secret = req.headers.get("x-collector-secret");
if (secret !== process.env.COLLECTOR_SECRET) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

The Python collector already accepts `--api-url` as a flag; adding `--api-secret` and injecting it as a header is trivial.

---

### 2. No Authentication on GET /api/export-readings

`src/app/api/export-readings/route.ts` — unauthenticated.

**Impact:** Full temperature history for all cameras is world-readable. With `take: 100_000` rows this can also be a lightweight DoS vector.

**Fix:** Same cookie/auth guard as above.

---

## High Priority

### 3. celsius=0 Sentinel Creates False Data Points on Charts

`src/app/api/temperature-readings/route.ts`, line 93:

```ts
celsius: 0, // celsius is non-nullable in schema, use 0 as sentinel
```

`connectNulls={false}` in the chart prevents line bridging — good. But the `celsius` field is set to `0` (not null), so it **will render as 0°C** on any chart that reads `celsius` without also checking `maxCelsius !== null`.

`getLatestReadings` returns `celsius: r.celsius` — no null guard — so the SSE-pushed reading for an offline camera is `{ celsius: 0, maxCelsius: null }`. `use-cameras.ts` does guard: `cam.celsius !== null && cam.timestamp` before adding to history, **but** `celsius` here is `0` (a number), so the guard passes and a `0°C` history point is pushed.

**Fix options:**
- Schema change: make `celsius` nullable (`Float? @db.Real`) and store `null`. This is the cleanest fix and aligns with the intent.
- Workaround without schema change: exclude null readings from history in `use-cameras.ts` by checking `cam.maxCelsius !== null` instead of `cam.celsius !== null`.

---

### 4. Duplicate IP Address Camera Resolution is Silently Non-Deterministic

`src/app/api/temperature-readings/route.ts`, line 38-40:

```ts
const cameraByIp = new Map(cameras.map((c) => [c.ipAddress, c]));
```

`ipAddress` has **no UNIQUE constraint** in `prisma/schema.prisma`. If two cameras share an IP (misconfiguration, NAT), the `Map` construction silently drops one. The "winner" is whichever Prisma returns last — order is `findMany` without `orderBy`, so non-deterministic.

**Fix:** Add a `@@unique([ipAddress])` constraint to the Camera model, or at minimum add a `@@index([ipAddress])`. Log a warning if `cameras.length > uniqueHosts.length` (more cameras than unique IPs found).

---

### 5. Camera Status Flip Uses One updateMany Per Host (N+1 Problem)

`src/app/api/temperature-readings/route.ts`, line 76-82:

```ts
const updated = await prisma.camera.updateMany({
  where: { cameraId: camera.cameraId, status: { not: newStatus } },
  data: { status: newStatus },
});
```

This fires one DB round-trip per camera host in the batch. With 8 workers posting simultaneously, this becomes 8 sequential awaits inside the `for...of` loop.

**Fix:** Collect all `(cameraId, newStatus)` pairs, then do two `updateMany` calls — one for all cameras going ACTIVE, one for all going INACTIVE:

```ts
await prisma.camera.updateMany({
  where: { cameraId: { in: activeCameraIds }, status: { not: "ACTIVE" } },
  data: { status: "ACTIVE" },
});
```

---

### 6. CSV Injection in Export

`src/app/api/export-readings/route.ts`, line 38-40:

```ts
const name = r.camera.name.replace(/,/g, " ");
const location = r.camera.location.replace(/,/g, " ");
return `${r.cameraId},${name},${location},${ts},${r.celsius},...`;
```

Commas are stripped, but spreadsheet formula injection is not blocked. A camera named `=CMD(|/C calc)` or `@SUM(1+1)` will execute in Excel/LibreOffice when the CSV is opened.

**Fix:** Prefix any cell starting with `=`, `+`, `-`, `@`, `\t`, or `\r` with a single quote or wrap in double-quotes with escaping:

```ts
function safeCsvCell(value: string): string {
  const s = String(value).replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(s)) return `"'${s}"`;
  return `"${s}"`;
}
```

---

## Medium Priority

### 7. validate.ts: Temperature Bounds Not Checked

`src/lib/validate.ts`, `validateTemperatureReading`:

Temperature values pass through with no range check. A payload `{ max_temperature: 9999999 }` is accepted. Physical Hanwha thermal cameras report -40°C to +2000°C (extreme cases). A reasonable guard:

```ts
if (typeof d[key] === "number" && (d[key] < -100 || d[key] > 3000)) {
  throw new ValidationError(`${key} value ${d[key]} is outside plausible range`);
}
```

---

### 8. validate.ts: Timestamp Accepts Far-Future Dates

`validateTemperatureReading` accepts `ts_utc: "2099-01-01T00:00:00Z"`. A collector clock misconfiguration could insert readings far in the future, poisoning chart time axes.

**Fix:** Reject timestamps more than 5 minutes in the future:

```ts
if (ts.getTime() > Date.now() + 5 * 60 * 1000) {
  throw new ValidationError("ts_utc is in the future");
}
```

---

### 9. install-cron.sh: API_URL Not Quoted in CRON_ENTRY

`scripts/install-cron.sh`, line 24:

```bash
CRON_ENTRY="* * * * * cd ${SCRIPT_DIR} && python3 ${PYTHON_SCRIPT} --api-url ${API_URL} >> ${LOG_FILE} 2>&1"
```

`API_URL` and other variables are unquoted inside the double-quoted string. If the path or URL contains spaces (unlikely but possible in non-standard deployments), cron will misparse the entry. More importantly, a user-supplied `API_URL` with shell metacharacters could inject into the crontab.

**Fix:** Single-quote the variable values in the cron string, or use printf with %q:

```bash
CRON_ENTRY="* * * * * cd '${SCRIPT_DIR}' && python3 '${PYTHON_SCRIPT}' --api-url '${API_URL}' >> '${LOG_FILE}' 2>&1"
```

---

### 10. install-cron.sh: Log File Created Without Permission Check

`scripts/install-cron.sh`, line 40:

```bash
touch "$LOG_FILE"  # LOG_FILE = /var/log/thermal-collector.log
```

This requires root. If the script runs as a non-root user the `touch` fails, but `set -euo pipefail` will abort — after the cron job was already installed. The installed cron will also fail silently because it can't write to `/var/log/`.

**Fix:** Create the log file before installing the cron, and fall back to a user-writable path:

```bash
touch "$LOG_FILE" 2>/dev/null || LOG_FILE="${HOME}/.thermal-collector.log"
```

---

### 11. rtsp_metadata_temp_collector.py: NULL Payload Includes status="failed" but API Ignores It

`process_camera` emits `status: "failed"` in the null payload. `validateTemperatureReading` accepts this field but `temperature-readings/route.ts` never reads `r.status`. The field is dead. This is low risk but implies future intent — document or act on it.

---

### 12. camera-card.tsx: Duplicate JSX Comment

`src/components/dashboard/camera-card.tsx`, lines 204-206:

```tsx
{/* TEMPERATURE */}

{/* TEMPERATURE */}
```

Duplicate comment, trivial cleanup.

---

## Low Priority

### 13. export-readings: take: 100_000 Rows Loaded Into Memory

`src/app/api/export-readings/route.ts`, line 31:

```ts
take: 100000, // safety limit
```

100k rows are fully materialized in memory before CSV serialization. For large deployments this is several hundred MB of RAM.

**Consider:** Streaming response with Prisma cursor pagination, or Node.js `Readable` stream piped to the response. Acceptable for now given the monitoring scale, but worth noting for future.

---

### 14. Page.tsx: groups state typed as any[]

`src/app/(dashboard)/page.tsx`, line 18:

```ts
const [groups, setGroups] = useState<any[]>([]);
```

Should use the proper `Group` type from `@/types/`.

---

### 15. TemperatureLineChart: Area/min band uses white fill instead of transparent

`src/components/charts/temperature-line-chart.tsx`, line 86-87:

```tsx
fill="var(--background, #ffffff)"
fillOpacity={1}
```

In dark mode, `--background` is not white. The chart correctly uses `var(--background)` CSS variable, so dark-mode rendering should be fine — but the `#ffffff` fallback will paint white in environments where CSS vars aren't resolved (e.g., SSR renders, PDF export). Minor.

---

## Edge Cases Found by Scout

- **Concurrent cron runs:** `install-cron.sh` runs the collector `* * * * *` (every minute). With `--workers 8` and `--read-timeout 10`, a single cycle can take up to 80 seconds under load. Cron will launch a second instance while the first is still running. No lock file mechanism exists. Multiple concurrent processes will POST duplicate readings within the same minute.

  **Mitigation:** Add a `flock` guard or use `--interval-seconds 60` with a persistent daemon rather than cron-per-minute.

- **All-null batch:** If all cameras fail, the POST body is a batch of null readings. The handler reaches `readingsToInsert.length > 0` (true — null sentinel rows), inserts them, then `validReadings` is empty so alerts are skipped correctly. Status is set INACTIVE for all. This path is correct.

- **Camera with no readings yet:** `getLatestReadings` uses `LEFT JOIN LATERAL` — cameras with no readings get `celsius: null`, `timestamp: null`. `use-cameras.ts` guards on `cam.celsius !== null` for history — correct. The `camera-card` handles `camera.celsius === null` via `--` display. This path is handled.

- **ROI dedup in Python, but not in API route:** `process_camera` deduplicates by ROI key (`deduped_rows[str(row["roi"])] = row`). However, the API route loops over all `hostReadings` which can still have multiple ROIs for the same camera. All are inserted as separate readings. The comment "use max of all ROIs" on line 85 is misleading — all ROI rows are inserted, not aggregated. This means a camera with 4 ROIs generates 4 readings per cycle.

---

## Positive Observations

- Validator functions are thorough — `isFinite` checks, typed interfaces, proper batch size cap against `MAX_BATCH_SIZE`.
- Alert evaluation and SSE publish are correctly fire-and-forget with isolated try/catch — they never abort the main insert.
- `connectNulls={false}` is the correct Recharts setting to show gaps instead of bridging over offline periods.
- `hasValidReading` logic (any non-null reading in batch → ACTIVE) is sensible and handles partial ROI failures gracefully.
- Python script's `ROI_COORDINATE_CACHE` prevents redundant HTTP calls within a collection cycle.
- TypeScript check passes cleanly on the new code (only pre-existing `xlsx` type error in unrelated script).

---

## Recommended Actions (Priority Order)

1. **[Critical]** Add authentication to `POST /api/temperature-readings` — shared secret header via env var.
2. **[Critical]** Add authentication to `GET /api/export-readings`.
3. **[High]** Fix `celsius=0` sentinel — either make schema column nullable or filter null readings in chart history by checking `maxCelsius !== null`.
4. **[High]** Add `@@unique([ipAddress])` constraint to Camera model, or add warning log for duplicate IPs.
5. **[High]** Batch camera status updates (replace N sequential `updateMany` with 2 bulk calls).
6. **[High]** Sanitize CSV cells for formula injection in export endpoint.
7. **[Medium]** Add temperature value range validation in `validateTemperatureReading`.
8. **[Medium]** Add future-timestamp rejection in `validateTemperatureReading`.
9. **[Medium]** Quote variables in `install-cron.sh` cron entry string; handle log file permission failure.
10. **[Medium]** Add `flock` or run-lock to cron command to prevent overlapping collector runs.
11. **[Low]** Type `groups` state in `page.tsx` properly.
12. **[Low]** Remove duplicate `{/* TEMPERATURE */}` comment in `camera-card.tsx`.

---

## Metrics

| Metric | Value |
|--------|-------|
| TypeScript errors (new code) | 0 |
| TypeScript errors (pre-existing) | 2 (unrelated xlsx script) |
| Unauthenticated write endpoints | 2 (critical) |
| Linting issues | Minor (any[] type) |

---

## Unresolved Questions

1. Is `POST /api/temperature-readings` intended to be called only by the local cron job (machine-to-machine, no user session), or also by users? This determines whether cookie auth or a shared secret is the right approach.
2. Should multi-ROI cameras insert one row per ROI, or should the API aggregate ROIs into one reading per camera per cycle? The current behavior (one row per ROI) affects chart granularity and alert evaluation.
3. Is there a planned retention policy for the `readings` table? With cron running every minute and 100k export cap, table growth will be substantial over months.
