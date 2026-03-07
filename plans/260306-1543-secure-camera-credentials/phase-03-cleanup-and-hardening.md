# Phase 3: Cleanup & Hardening

## Priority: MEDIUM
## Status: TODO

## Overview

Final hardening: mask passwords in API responses for non-admin contexts, add key rotation support, clean up documentation.

## Implementation Steps

### 1. Mask passwords in API list responses

Camera list endpoint should return `"********"` instead of decrypted password.
Only return real password when explicitly needed (e.g., collector, test-connection).

Update `src/app/api/cameras/route.ts` GET handler:
```typescript
// Mask passwords in list response
const cameras = (await listCameras()).map(c => ({
  ...c,
  password: c.password ? "********" : null,
}));
```

### 2. Add password visibility control in edit form

Camera form already uses `type="password"` input — no change needed.
But ensure the edit form pre-fills with masked value, only sends new password if changed.

### 3. Documentation updates

- Update `docs/deployment-guide.md` — document `CAMERA_ENCRYPTION_KEY` env var
- Update `docs/system-architecture.md` — add encryption section
- Update `docs/code-standards.md` — document crypto-utils pattern

### 4. Key rotation script (optional, future)

Create `scripts/rotate-encryption-key.ts`:
- Takes old key and new key as args
- Decrypts all passwords with old key, re-encrypts with new key
- Atomic transaction

## Todo

- [ ] Mask passwords in camera list API response
- [ ] Handle edit form: only encrypt if password field changed
- [ ] Update deployment docs with CAMERA_ENCRYPTION_KEY setup
- [ ] Update system architecture docs with encryption flow
- [ ] (Optional) Create key rotation script

## Success Criteria

- Camera list API never exposes real passwords
- Edit form works correctly (doesn't re-encrypt masked value)
- Docs updated for deployment
