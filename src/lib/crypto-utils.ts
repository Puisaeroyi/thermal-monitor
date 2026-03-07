/**
 * AES-256-GCM encryption utilities for camera password encryption.
 *
 * Format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 * - iv: 12-byte (96-bit) initialization vector
 * - authTag: 16-byte GCM authentication tag
 * - ciphertext: encrypted password
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1:";

/**
 * Get the encryption key from environment variable.
 * Key must be a 64-character hex string (32 bytes = 256 bits).
 */
function getKey(): Buffer {
  const hex = process.env.CAMERA_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "CAMERA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a camera password using AES-256-GCM.
 * @param plaintext - The plain text password
 * @returns Encrypted string in format: enc:v1:<iv>:<authTag>:<ciphertext>
 */
export function encryptPassword(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a camera password using AES-256-GCM.
 * Handles backward compatibility: if value doesn't have prefix, returns as-is.
 * @param stored - The encrypted password string
 * @returns Decrypted plain text password
 */
export function decryptPassword(stored: string): string {
  // Backward compatibility: unencrypted passwords pass through
  if (!stored.startsWith(PREFIX)) {
    return stored;
  }

  const parts = stored.slice(PREFIX.length).split(":");
  const [ivHex, authTagHex, ciphertextHex] = parts;

  const key = getKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Check if a password value is already encrypted.
 * @param value - The password string to check
 * @returns true if the value is encrypted (has enc:v1: prefix)
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}
