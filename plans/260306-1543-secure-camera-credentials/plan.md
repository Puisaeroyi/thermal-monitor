# Secure Camera Credentials

## Problem

Camera credentials (username/password) stored in **plain text** in two places:
1. **Database** (`cameras` table) — plain text `username`/`password` columns
2. **JSON file** — collector reads `--cameras cameras.json` with raw passwords

Neither is encrypted. Anyone with DB or file access can read all camera passwords.

## Status

| Phase | Status | Priority |
|-------|--------|----------|
| Phase 1: Encrypt passwords at rest (DB) | COMPLETE | HIGH |
| Phase 2: Collector reads from DB | COMPLETE | HIGH |
| Phase 3: Cleanup & hardening | COMPLETE | MEDIUM |

## Architecture

```
CURRENT:
  UI Form --> API --> DB (plain text password)
  JSON file (plain text) --> Collector --> Camera RTSP

PROPOSED:
  UI Form --> API --> encrypt(password) --> DB (encrypted)
  Collector --> DB --> decrypt(password) --> Camera RTSP
```

**Encryption**: AES-256-GCM via Node.js `crypto` module (symmetric, authenticated)
**Key source**: `CAMERA_ENCRYPTION_KEY` env var (32-byte hex string)
**Python side**: `cryptography` package (Fernet or AES-256-GCM) using same key

## Key Decisions

1. **AES-256-GCM** (not Fernet) — native to both Node.js and Python, no extra deps on Node side
2. **Env var for key** — simple, standard, works in Docker
3. **Collector reads DB directly** — eliminates JSON file entirely, single source of truth
4. **Backward compatible** — detect unencrypted passwords during migration, encrypt in place

## Dependencies

- Node.js `crypto` (built-in) — no new npm deps
- Python `cryptography` package — new pip dep for collector
- `DATABASE_URL` env var accessible to collector (already exists in `.env.local`)

---

See phase files for implementation details.
