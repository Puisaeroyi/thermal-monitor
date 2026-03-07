# Phase 2: Collector Reads Camera Configs from Database

## Priority: HIGH
## Status: TODO

## Overview

Modify the Python RTSP metadata collector to read camera configs (host, port, username, password) directly from the PostgreSQL database instead of a JSON file. Decrypt passwords using the same AES-256-GCM key.

## Key Insights

- Collector currently uses `--cameras cameras.json` — plain text passwords on disk
- DB already has `ip_address`, `port`, `username`, `password` columns on `cameras` table
- Only cameras with `status = 'ACTIVE'` and non-null `ip_address` should be collected
- Python `cryptography` package supports AES-256-GCM natively
- Collector already uses `DATABASE_URL` pattern (via `--api-url`), adding DB access is consistent

## Related Code Files

**Modify:**
- `rtsp_metadata_temp_collector.py` — add `--from-db` mode, add decrypt function
- `requirements.txt` or inline pip install — add `psycopg2-binary`, `cryptography`

**No changes needed:**
- `prisma/schema.prisma` — already has the fields
- `src/services/camera-service.ts` — Phase 1 handles encryption

## Implementation Steps

### 1. Add Python decrypt function

Must match Node.js `enc:v1:<iv>:<authTag>:<ciphertext>` format exactly.

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import binascii

PREFIX = "enc:v1:"

def decrypt_password(stored: str, key_hex: str) -> str:
    """Decrypt AES-256-GCM encrypted password matching Node.js format."""
    if not stored.startswith(PREFIX):
        return stored  # backward compat: plain text
    parts = stored[len(PREFIX):].split(":")
    iv = binascii.unhexlify(parts[0])
    auth_tag = binascii.unhexlify(parts[1])
    ciphertext = binascii.unhexlify(parts[2])
    key = binascii.unhexlify(key_hex)
    aesgcm = AESGCM(key)
    # GCM expects ciphertext + tag concatenated
    plaintext = aesgcm.decrypt(iv, ciphertext + auth_tag, None)
    return plaintext.decode("utf-8")
```

### 2. Add `--from-db` flag to collector

```python
parser.add_argument("--from-db", action="store_true",
    help="Read camera configs from database instead of JSON file")
parser.add_argument("--database-url", type=str, default=None,
    help="PostgreSQL connection URL (or set DATABASE_URL env var)")
parser.add_argument("--encryption-key", type=str, default=None,
    help="AES-256 key hex (or set CAMERA_ENCRYPTION_KEY env var)")
```

### 3. Add DB camera loader

```python
import psycopg2

def load_cameras_from_db(database_url: str, encryption_key: str) -> list[CameraConfig]:
    """Query active cameras with IP addresses from PostgreSQL."""
    conn = psycopg2.connect(database_url)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT ip_address, port, username, password, name
                FROM cameras
                WHERE status = 'ACTIVE'
                  AND ip_address IS NOT NULL
                  AND username IS NOT NULL
            """)
            cameras = []
            for row in cur.fetchall():
                ip, port, user, pwd, name = row
                if pwd and encryption_key:
                    pwd = decrypt_password(pwd, encryption_key)
                cameras.append(CameraConfig(
                    host=ip, port=port or 80,
                    username=user, password=pwd or "",
                    name=name
                ))
            return cameras
    finally:
        conn.close()
```

### 4. Update main() to support both modes

```python
if args.from_db:
    db_url = args.database_url or os.environ.get("DATABASE_URL")
    enc_key = args.encryption_key or os.environ.get("CAMERA_ENCRYPTION_KEY")
    if not db_url:
        parser.error("--database-url or DATABASE_URL env required with --from-db")
    cameras = load_cameras_from_db(db_url, enc_key or "")
else:
    if not args.cameras:
        parser.error("--cameras required when not using --from-db")
    cameras = load_cameras(args.cameras)
```

### 5. Update Docker/cron setup

Modify `scripts/install-cron.sh` or Docker entrypoint to use `--from-db` flag:
```bash
python3 rtsp_metadata_temp_collector.py \
  --from-db \
  --api-url http://localhost:3000/api/temperature-readings \
  --interval-seconds 60
```

## Todo

- [ ] Add `decrypt_password()` Python function matching Node.js format
- [ ] Add `load_cameras_from_db()` function with psycopg2
- [ ] Add `--from-db`, `--database-url`, `--encryption-key` CLI args
- [ ] Update `main()` to support both JSON and DB modes
- [ ] Add `psycopg2-binary` and `cryptography` to requirements
- [ ] Test: encrypt password in DB via Node.js, decrypt in Python
- [ ] Test: collector runs with `--from-db` against real camera
- [ ] Update cron/Docker scripts to use `--from-db`

## Success Criteria

- Collector works with `--from-db` flag, no JSON file needed
- Passwords decrypted correctly (cross-language AES-256-GCM compat verified)
- Backward compat: `--cameras` JSON mode still works
- Only active cameras with IP + credentials are collected

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| AES-GCM format mismatch Node/Python | HIGH | Unit test: encrypt in Node, decrypt in Python |
| psycopg2 connection issues in Docker | MEDIUM | Use same DATABASE_URL, test in container |
| Collector needs DB access (new dependency) | LOW | DB already accessible on internal network |
