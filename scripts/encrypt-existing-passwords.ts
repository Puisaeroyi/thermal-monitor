#!/usr/bin/env tsx
/**
 * Migration: Encrypt existing plain-text camera passwords.
 *
 * This script queries all cameras with non-null, non-encrypted passwords
 * and encrypts them in place using AES-256-GCM.
 *
 * Safe to run multiple times (idempotent) - skips already-encrypted passwords.
 *
 * Usage:
 *   npx tsx scripts/encrypt-existing-passwords.ts
 */

import { prisma } from "@/lib/prisma";
import { encryptPassword, isEncrypted } from "@/lib/crypto-utils";

async function main() {
  console.log("Starting password encryption migration...\n");

  // Get all cameras with non-null passwords
  const cameras = await prisma.camera.findMany({
    where: {
      password: {
        not: null,
      },
    },
    select: {
      cameraId: true,
      name: true,
      password: true,
    },
  });

  if (cameras.length === 0) {
    console.log("No cameras with passwords found. Nothing to migrate.");
    return;
  }

  let encryptedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const camera of cameras) {
    const password = camera.password!;

    // Skip if already encrypted
    if (isEncrypted(password)) {
      console.log(`[SKIP] ${camera.name} (${camera.cameraId}): Already encrypted`);
      skippedCount++;
      continue;
    }

    try {
      // Encrypt the password
      const encryptedPassword = encryptPassword(password);

      // Update in database
      await prisma.camera.update({
        where: { cameraId: camera.cameraId },
        data: { password: encryptedPassword },
      });

      console.log(`[OK] ${camera.name} (${camera.cameraId}): Password encrypted`);
      encryptedCount++;
    } catch (error) {
      console.error(
        `[ERROR] ${camera.name} (${camera.cameraId}): Failed to encrypt - ${error instanceof Error ? error.message : String(error)}`
      );
      errorCount++;
    }
  }

  console.log("\n--- Migration Summary ---");
  console.log(`Total cameras with passwords: ${cameras.length}`);
  console.log(`Encrypted: ${encryptedCount}`);
  console.log(`Skipped (already encrypted): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);

  if (errorCount > 0) {
    console.warn("\nWarning: Some passwords failed to encrypt. Check errors above.");
    process.exit(1);
  } else {
    console.log("\nMigration completed successfully!");
  }
}

main()
  .catch((error) => {
    console.error("Migration failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
