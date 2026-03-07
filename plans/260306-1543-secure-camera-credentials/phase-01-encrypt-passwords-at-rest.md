# Phase 1: Encrypt Camera Passwords at Rest

## Priority: HIGH
## Status: TODO

## Overview

Add AES-256-GCM encryption for camera passwords in the database. Passwords encrypted on write, decrypted on read. Encryption key lives in env var only.

## Key Insights

- Camera passwords CANNOT be hashed (need actual password for digest auth)
- AES-256-GCM provides authenticated encryption (detects tampering)
- Format: `enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>` — prefixed so we can detect unencrypted values
- Node.js `crypto` module is built-in, zero new dependencies

## Related Code Files

**Modify:**
- `src/lib/crypto-utils.ts` (NEW) — encrypt/decrypt functions
- `src/services/camera-service.ts` — encrypt on create/update, decrypt on read
- `src/app/api/cameras/test-connection/route.ts` — may need decrypted password
- `.env.local` — add `CAMERA_ENCRYPTION_KEY`
- `docker-compose.yml` — pass env var to app container

**No changes needed:**
- `prisma/schema.prisma` — password column stays `String?`, encrypted string fits
- `src/components/cameras/camera-form-dialog.tsx` — sends plain text, API encrypts server-side

## Implementation Steps

### 1. Create encryption utility (`src/lib/crypto-utils.ts`)

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
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
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptPassword(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored; // unencrypted (backward compat)
  const parts = stored.slice(PREFIX.length).split(":");
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return decipher.update(Buffer.from(ciphertextHex, "hex")) + decipher.final("utf8");
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}
```

### 2. Update camera-service.ts

- `createCamera()`: encrypt password before `prisma.camera.create()`
- `updateCamera()`: encrypt password before `prisma.camera.update()`
- `getCamera()` / `listCameras()`: decrypt password in returned results
- Add helper: `decryptCameraPassword(camera)` to avoid repetition

### 3. Generate encryption key

```bash
# Add to .env.local
CAMERA_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

### 4. Migration script for existing plain-text passwords

Create `scripts/encrypt-existing-passwords.ts`:
- Query all cameras with non-null, non-encrypted passwords
- Encrypt each and update in DB
- Run once after deployment

### 5. Update docker-compose.yml

Pass `CAMERA_ENCRYPTION_KEY` env var to app container.

## Todo

- [ ] Create `src/lib/crypto-utils.ts` with encrypt/decrypt
- [ ] Update `camera-service.ts` to encrypt on write, decrypt on read
- [ ] Generate and add `CAMERA_ENCRYPTION_KEY` to `.env.local`
- [ ] Update `docker-compose.yml` to pass encryption key
- [ ] Create `scripts/encrypt-existing-passwords.ts` migration
- [ ] Run migration to encrypt existing passwords
- [ ] Test: create camera via UI, verify DB stores encrypted value
- [ ] Test: read camera back, verify password decrypted correctly

## Success Criteria

- DB contains only `enc:v1:...` values for camera passwords
- API responses return decrypted passwords (for authenticated admin users)
- Existing cameras with plain-text passwords auto-detected and still work (backward compat)
- No new npm dependencies

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Key lost = all passwords unrecoverable | HIGH | Document key backup procedure |
| Key in env var = accessible to process | LOW | Standard practice, better than plain DB |
| Migration fails midway | MEDIUM | Script is idempotent (skips already-encrypted) |

## Security Considerations

- Key MUST NOT be committed to git (in `.env.local`, already gitignored)
- Key MUST be backed up securely (password manager, vault)
- AES-256-GCM provides authentication — detects if ciphertext is tampered
- `enc:v1:` prefix allows future algorithm upgrades (v2, v3)
