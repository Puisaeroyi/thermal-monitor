# Code Standards & Conventions

Established patterns for Thermal Monitor development.

---

## File Organization

### Naming Conventions

| Type | Convention | Example | Rationale |
|------|-----------|---------|-----------|
| **Components** | PascalCase | `TemperatureSensorCard.tsx` | React standard |
| **Services** | kebab-case | `alert-evaluation-service.ts` | LLM-readable naming |
| **Utilities** | kebab-case | `temperature-utils.ts` | Self-documenting |
| **Hooks** | kebab-case, `use-` prefix | `use-cameras.ts` | React convention |
| **Tests** | `.test.ts` or `.spec.ts` | `reading-service.test.ts` | Jest standard |
| **Types** | kebab-case | `camera.ts` | Consistency |
| **DB Fields** | snake_case | `camera_id`, `created_at` | PostgreSQL convention |
| **Constants** | UPPER_SNAKE_CASE | `MAX_BATCH_SIZE` | Universal standard |

### File Size Limits

**Target:** <200 lines per code file

**Rationale:**
- Better LLM context management
- Single responsibility
- Easier to understand at a glance
- Faster CI/CD (smaller diffs)

**When to Split:**
- Service exceeds 200 lines → Extract utility functions
- Component has multiple concerns → Extract sub-components
- Test file too large → Split by feature area

**Exceptions:** Configuration files, migrations, seed data (no line limit)

### Directory Structure

```
src/
├── app/                    # Next.js App Router (pages + API)
│   ├── api/               # REST endpoints
│   │   ├── cameras/
│   │   ├── readings/
│   │   ├── thresholds/
│   │   ├── alerts/
│   │   ├── groups/
│   │   └── settings/
│   ├── dashboard/         # Client pages (only client components)
│   ├── cameras/
│   ├── alerts/
│   ├── comparison/
│   ├── settings/
│   └── layout.tsx         # Root layout (server component)
├── components/            # UI components (organized by domain)
│   ├── dashboard/         # Dashboard-specific
│   ├── cameras/           # Camera-related
│   ├── alerts/            # Alert-related
│   ├── charts/            # Chart components
│   ├── settings/          # Settings forms
│   ├── layout/            # Global layout (header, sidebar)
│   └── ui/                # shadcn/ui primitives (hand-maintained)
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities & singleton exports
│   ├── prisma.ts         # PrismaClient singleton
│   ├── validate.ts       # Input validation
│   ├── temperature-utils.ts
│   ├── constants.ts
│   └── utils.ts
├── services/              # Business logic & data access
│   ├── reading-service.ts
│   ├── camera-service.ts
│   ├── alert-service.ts
│   ├── alert-evaluation-service.ts
│   ├── threshold-service.ts
│   ├── threshold-cache.ts
│   ├── has-unread-alert.ts
│   ├── gap-ring-buffer.ts
│   └── email-service.ts
└── types/                 # TypeScript interfaces
    ├── camera.ts
    ├── threshold.ts
    └── alert.ts
```

---

## TypeScript Standards

### Strict Mode (Enabled)

All files compiled with TypeScript strict mode:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false
  }
}
```

### Type Safety Practices

**1. Always type function parameters:**
```typescript
// ✓ Good
export function formatTemperature(celsius: number, unit: "C" | "F"): string {
  return `${celsius}°${unit}`;
}

// ✗ Bad
export function formatTemperature(celsius, unit) {
  return `${celsius}°${unit}`;
}
```

**2. Use interfaces for API responses:**
```typescript
// ✓ Good
export interface CameraReading {
  cameraId: string;
  name: string;
  celsius: number | null;
  timestamp: string | null;
}

// ✗ Bad
const data = await fetch("/api/cameras").then(r => r.json());
```

**3. Avoid `any` — use `unknown` if needed:**
```typescript
// ✓ Good
function parseInput(data: unknown): CameraInput {
  if (!data || typeof data !== "object") throw new ValidationError(...);
  // ...
}

// ✗ Bad
function parseInput(data: any) { /* ... */ }
```

**4. Discriminated unions for polymorphic types:**
```typescript
// ✓ Good
export type Alert =
  | { type: "TEMPERATURE"; thresholdValue: number; }
  | { type: "GAP"; direction: "RISE" | "DROP" | "BOTH"; };

// ✗ Bad
export interface Alert {
  type: string;
  thresholdValue?: number;
  direction?: string;
}
```

---

## React & Component Standards

### Component Structure

**Functional components only.** No class components.

**Standard pattern:**
```typescript
"use client";  // Add if component uses hooks

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface TemperatureSensorCardProps {
  cameraId: string;
  celsius: number;
  status: "normal" | "warning" | "danger";
}

export function TemperatureSensorCard({
  cameraId,
  celsius,
  status,
}: TemperatureSensorCardProps) {
  return (
    <div className={cn("card", `status-${status}`)}>
      <h3>{cameraId}</h3>
      <p>{celsius}°C</p>
    </div>
  );
}
```

### Props Pattern

**Always define props interface:**
```typescript
interface MyComponentProps {
  title: string;
  count?: number;  // Optional props use ?
  onClose: () => void;
  children?: ReactNode;
}

export function MyComponent({ title, count = 0, onClose, children }: MyComponentProps) {
  // ...
}
```

**Avoid prop spreading:**
```typescript
// ✗ Bad — hides required props
export function MyComponent(props: Record<string, unknown>) {
  return <div {...props} />;
}

// ✓ Good — explicit, type-safe
interface MyComponentProps {
  title: string;
  className?: string;
}
export function MyComponent({ title, className }: MyComponentProps) {
  return <div className={className}>{title}</div>;
}
```

### Hook Patterns

**Use custom hooks to extract state logic:**
```typescript
// ✓ Good — reusable polling logic
export function usePolling<T>(url: string, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(url);
        setData(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [url, intervalMs]);

  return { data, error };
}

// In component:
export function Dashboard() {
  const { data: cameras } = usePolling("/api/readings/latest", 5000);
  // ...
}
```

**Dependencies in useEffect:**
```typescript
// ✓ Good — explicit deps prevent stale closures
useEffect(() => {
  fetchData(cameraId);
}, [cameraId]);  // Re-run if cameraId changes

// ✗ Bad — missing dep, can cause stale state
useEffect(() => {
  fetchData(cameraId);
}, []);  // Will only run once, cameraId is stale
```

### Client vs Server Components

**Root layout:** Server component
```typescript
// src/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

**Pages with interactivity:** Client components
```typescript
// src/app/dashboard/page.tsx
"use client";

import { useCameras } from "@/hooks/use-cameras";

export default function DashboardPage() {
  const { cameras, isLoading } = useCameras();
  return <div>{/* render */}</div>;
}
```

---

## Database & Service Standards

### Service Layer Pattern

**All DB access in services, never in components:**

```typescript
// ✓ Good
// src/services/camera-service.ts
export async function listCameras() {
  return prisma.camera.findMany();
}

// src/app/api/cameras/route.ts
export async function GET() {
  const cameras = await listCameras();  // Import from service
  return NextResponse.json(cameras);
}

// ✗ Bad — DB access in API route
export async function GET() {
  const cameras = await prisma.camera.findMany();  // Direct access
  return NextResponse.json(cameras);
}
```

### Validation Pattern

**Validate all inputs with custom validators:**

```typescript
// src/lib/validate.ts
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateCameraInput(data: unknown): CameraInput {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }
  const d = data as Record<string, unknown>;

  if (!d.cameraId || typeof d.cameraId !== "string") {
    throw new ValidationError("cameraId must be a non-empty string");
  }

  return { cameraId: d.cameraId as string, /* ... */ };
}

// src/app/api/cameras/route.ts
export async function POST(req: NextRequest) {
  try {
    const input = validateCameraInput(await req.json());
    const camera = await createCamera(input);
    return NextResponse.json(camera, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### Error Handling

**All async errors must be caught:**

```typescript
// ✓ Good
try {
  const reading = await prisma.reading.create({ data });
  return NextResponse.json(reading);
} catch (err) {
  console.error("[POST /readings]", err);
  return NextResponse.json({ error: "Failed to ingest readings" }, { status: 500 });
}

// ✗ Bad — unhandled promise rejection
export async function POST(req: NextRequest) {
  const data = await req.json();
  const reading = await prisma.reading.create({ data });  // Can throw!
  return NextResponse.json(reading);
}
```

### Non-Critical Failures

**Email notifications must not block reading ingestion:**

```typescript
// ✓ Good — promise not awaited, non-blocking
export async function ingestReadings(readings: ReadingInput[]) {
  const result = await prisma.reading.createMany({ data: readings });

  // Send emails in background, don't await
  readings.forEach(async (r) => {
    try {
      await sendAlertEmail(r.cameraId, r.celsius);
    } catch (err) {
      console.error("[email]", err);  // Log but don't re-throw
    }
  });

  return { inserted: result.count };
}
```

---

## API Route Standards

### Route Structure

```typescript
// src/app/api/[resource]/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const data = await fetchData();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[GET /api/...]", err);
    return NextResponse.json({ error: "..." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = validateInput(await req.json());
    const result = await createData(input);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[POST /api/...]", err);
    return NextResponse.json({ error: "..." }, { status: 500 });
  }
}
```

### Response Codes

| Code | Use Case |
|------|----------|
| 200 | Successful GET, PUT, DELETE |
| 201 | Successful POST (resource created) |
| 400 | Bad request (validation error) |
| 404 | Resource not found |
| 500 | Server error |

---

## Styling Standards

### Tailwind CSS

**Use utility-first approach:**
```tsx
// ✓ Good
<div className="flex gap-4 p-4 bg-white rounded-lg shadow">
  <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
    Click me
  </button>
</div>

// ✗ Bad — arbitrary values
<div style={{ display: "flex", gap: "16px", padding: "16px" }}>
  <button style={{ backgroundColor: "rgb(59, 130, 246)" }}>Click me</button>
</div>
```

**Use `cn()` for conditional classes:**
```tsx
import { cn } from "@/lib/utils";

interface ButtonProps {
  variant?: "primary" | "secondary";
  className?: string;
}

export function Button({ variant = "primary", className }: ButtonProps) {
  return (
    <button
      className={cn(
        "px-4 py-2 rounded transition",
        variant === "primary" && "bg-blue-500 text-white hover:bg-blue-600",
        variant === "secondary" && "bg-gray-200 text-black hover:bg-gray-300",
        className  // Allow overrides
      )}
    >
      {/* ... */}
    </button>
  );
}
```

### Dark Mode

**Use `dark:` prefix for dark mode variants:**
```tsx
<div className="bg-white text-black dark:bg-slate-900 dark:text-white">
  Content
</div>
```

**Theme provider configured in layout:**
```tsx
// src/app/layout.tsx
import { ThemeProvider } from "@/components/layout/theme-provider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

---

## Testing Standards

### File Placement

- **Unit tests:** `src/**/*.test.ts` (same directory as source)
- **Integration tests:** `tests/integration/`
- **E2E tests:** `tests/e2e/`

### Test Structure

```typescript
// src/services/reading-service.test.ts
import { ingestReadings, queryReadings } from "./reading-service";

describe("reading-service", () => {
  describe("ingestReadings", () => {
    it("should insert readings and evaluate thresholds", async () => {
      const readings = [
        { cameraId: "cam1", celsius: 25, timestamp: "2026-02-27T00:00:00Z" },
      ];
      const result = await ingestReadings(readings);
      expect(result.inserted).toBe(1);
    });

    it("should throw ValidationError on invalid input", async () => {
      expect(() => ingestReadings([])).rejects.toThrow(ValidationError);
    });
  });
});
```

### Test Coverage Targets

- **Critical business logic** (threshold evaluation, alert creation): 100%
- **Services** (DB access, data transformation): >80%
- **Hooks** (state management, side effects): >70%
- **Components** (rendering, event handlers): >60%
- **Utils** (formatting, helpers): >90%

---

## Git & Commit Standards

### Commit Message Format

Use conventional commits:

```
<type>(<scope>): <subject>

<body>
<footer>
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`

**Examples:**
```
feat(dashboard): add drag-and-drop camera panels

fix(alert-service): prevent duplicate alerts with state-based suppression

docs: update API endpoint documentation

refactor(services): split reading-service into smaller modules

test(threshold-evaluation): add edge case coverage for gap detection

chore: upgrade Prisma to 7.4.1
```

### Commit Best Practices

1. **Keep commits focused** — One logical change per commit
2. **Write descriptive messages** — Explain "why", not just "what"
3. **No large rewrites** — Split into smaller commits
4. **Reference issues** — "Closes #123" in footer if applicable
5. **Run linter before commit** — `npm run lint`

---

## Code Review Checklist

- [ ] Passes TypeScript strict mode (`npm run build`)
- [ ] Passes linter (`npm run lint`)
- [ ] No console.error logs (only for debugging)
- [ ] No `any` types (use `unknown` + guards)
- [ ] Validation on all external inputs
- [ ] Error handling for async operations
- [ ] Comments explain "why", not "what"
- [ ] No unused imports or variables
- [ ] File size <200 lines (split if needed)
- [ ] Tests added/updated for changes
- [ ] Docs updated if API/behavior changed

---

## Performance Considerations

### Query Optimization

**Use LATERAL JOIN for latest readings (not N queries):**
```typescript
// ✓ Good — single query, O(1) per camera
export async function getLatestReadings() {
  return prisma.$queryRaw`
    SELECT DISTINCT ON (c.camera_id) ...
    FROM cameras c
    LEFT JOIN LATERAL (...) r ON true
  `;
}

// ✗ Bad — N+1 queries
const cameras = await prisma.camera.findMany();
for (const cam of cameras) {
  const latest = await prisma.reading.findFirst({
    where: { cameraId: cam.cameraId },
    orderBy: { timestamp: "desc" },
  });
}
```

### Caching Strategy

**In-memory caches for thresholds (reloaded on create/update):**
```typescript
// src/services/threshold-cache.ts
let cachedThresholds: TemperatureThreshold[] = [];

export async function refreshCache() {
  cachedThresholds = await prisma.temperatureThreshold.findMany();
}

export function getCachedThresholds() {
  return cachedThresholds;
}

// Call refreshCache on app startup + after create/update
```

### Polling Interval

**5-second polling = good balance:**
- <5s: too many DB hits, high latency
- >5s: stale data on dashboard

Upgrade path: SSE or WebSocket if <2s needed.

---

## Dependencies & Imports

### Import Organization

```typescript
// 1. External packages
import { useState } from "react";
import { prisma } from "@prisma/client";

// 2. Internal absolute imports (use @ alias)
import { useCameras } from "@/hooks/use-cameras";
import { CameraCard } from "@/components/dashboard/camera-card";
import { formatTemperature } from "@/lib/temperature-utils";
import type { CameraReading } from "@/types/camera";

// 3. Relative imports (only for same directory)
import { getColor } from "./helpers";
```

### Avoid Circular Dependencies

```typescript
// ✗ Bad — A imports B, B imports A
// services/a.ts
import { funcB } from "./b";

// services/b.ts
import { funcA } from "./a";

// ✓ Good — Extract shared logic to utility
// lib/shared.ts
export function shared() { /* ... */ }

// services/a.ts
import { shared } from "@/lib/shared";

// services/b.ts
import { shared } from "@/lib/shared";
```

---

## Documentation in Code

### Comment Guidelines

**Only comment "why", never "what":**

```typescript
// ✗ Bad — the code already shows what it does
const celsius = (fahrenheit - 32) * (5 / 9);  // Convert F to C

// ✓ Good — explains the business logic
// Convert Fahrenheit input to Celsius for database storage
const celsius = (fahrenheit - 32) * (5 / 9);

// ✓ Good — explains a non-obvious decision
// Use raw SQL instead of ORM to avoid N+1 queries on large camera counts
const latestReadings = await prisma.$queryRaw`...`;
```

### JSDoc for Public APIs

```typescript
/**
 * Evaluate a reading against temperature and gap thresholds.
 * Creates alerts if breach detected and respects state-based suppression.
 * Non-blocking email notifications are queued asynchronously.
 *
 * @param cameraId - Camera identifier
 * @param celsius - Temperature reading
 * @param timestamp - Reading timestamp (ISO 8601)
 * @throws {Error} If database write fails
 *
 * @example
 * await evaluateReading("cam-001", 42.5, new Date().toISOString());
 */
export async function evaluateReading(
  cameraId: string,
  celsius: number,
  timestamp: string
): Promise<void> {
  // ...
}
```

---

## Environment & Configuration

### .env.local Template

```bash
# Required
DATABASE_URL="postgresql://user:password@localhost:5432/thermal_monitor"

# Optional (email notifications)
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER=""
SMTP_PASS=""
ALERT_FROM_EMAIL="alerts@thermal.local"

# Optional (feature flags)
DEBUG="false"
```

### No Secrets in Code

**✗ Bad:**
```typescript
const API_KEY = "sk-12345";  // Never hardcode!
```

**✓ Good:**
```typescript
const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error("Missing API_KEY env var");
```

---

## Threshold Scope Pattern

Thresholds support three scope levels, determined by which field is set:

| Scope | Description | cameraId | groupId | Use Case |
|-------|-------------|----------|---------|----------|
| **Global** | Applies to all cameras | `null` | `null` | Facility-wide temperature limits |
| **Camera-Specific** | Applies to one camera | Set | `null` | Custom limits for individual sensors |
| **Group-Scoped** | Applies to all cameras in a group | `null` | Set | Department/zone-specific rules |

**Evaluation priority:** Camera-specific > Group-scoped > Global (most specific wins)

**Filter logic in alert evaluation:**
```typescript
const applicableThresholds = allThresholds.filter(t =>
  // Global threshold
  (t.cameraId === null && t.groupId === null) ||
  // Camera-specific
  t.cameraId === cameraId ||
  // Group-scoped: camera must belong to this group
  (t.groupId !== null && t.groupId === cameraGroupId)
);
```

---

## Temperature Utility Functions

**celsiusToFahrenheit:** Converts Celsius to Fahrenheit with proper operator precedence:
```typescript
export function celsiusToFahrenheit(c: number): number {
  // Note: Parentheses critical for correct precedence
  return Math.round((c * 9 / 5 + 32) * 10) / 10;
}
```

Result is rounded to 1 decimal place. Always used for display only; storage is in Celsius.

---

## Encryption & Security Utilities

### Camera Password Encryption (AES-256-GCM)

Camera credentials are encrypted at rest using AES-256-GCM symmetric encryption.

**Pattern:**
```typescript
// src/lib/crypto-utils.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const hex = process.env.CAMERA_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("CAMERA_ENCRYPTION_KEY must be 64-char hex (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptPassword(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptPassword(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored; // backward compat
  const [ivHex, authTagHex, ciphertextHex] = stored.slice(PREFIX.length).split(":");
  const key = getKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return decipher.update(Buffer.from(ciphertextHex, "hex")) + decipher.final("utf8");
}
```

**Key Management:**
- Key stored in `CAMERA_ENCRYPTION_KEY` env var (64-char hex = 32 bytes)
- Generate with: `openssl rand -hex 32`
- **Backup key securely** - if lost, all passwords unrecoverable
- Key never committed to git (`.env.local` is gitignored)

**Encrypted Format:**
```
enc:v1:<12-byte-iv-hex>:<16-byte-authTag-hex>:<ciphertext-hex>
```

**Cross-Language Compatibility (Node.js ↔ Python):**

Python equivalent using `cryptography` package:
```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import binascii

def decrypt_password(stored: str, key_hex: str) -> str:
    PREFIX = "enc:v1:"
    if not stored.startswith(PREFIX):
        return stored
    parts = stored[len(PREFIX):].split(":")
    iv = binascii.unhexlify(parts[0])
    auth_tag = binascii.unhexlify(parts[1])
    ciphertext = binascii.unhexlify(parts[2])
    key = binascii.unhexlify(key_hex)
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(iv, ciphertext + auth_tag, None)
    return plaintext.decode("utf-8")
```

**Usage in Services:**
```typescript
// Encrypt on write (create/update)
export async function createCamera(input: CameraInput) {
  return prisma.camera.create({
    data: {
      // ... other fields
      password: input.password ? encryptPassword(input.password) : null,
    },
  });
}

// Decrypt on read
export async function getCamera(cameraId: string) {
  const camera = await prisma.camera.findUnique({ where: { cameraId } });
  return camera ? { ...camera, password: decryptPassword(camera.password) } : null;
}
```

**Security Considerations:**
- Passwords masked in list API responses: `"********"`
- Edit form only updates password if field is explicitly changed
- Migration script (`scripts/encrypt-existing-passwords.ts`) encrypts existing plain-text passwords
- AES-256-GCM provides authenticated encryption (detects tampering)

---

## Unresolved Questions

- [ ] Should we use a Zod validation library (vs current custom approach)?
- [ ] WebSocket upgrade path — priority?
- [ ] Test framework choice (Jest, Vitest, Playwright)?
- [ ] E2E testing strategy for multi-camera scenarios?
