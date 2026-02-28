-- AlterTable
ALTER TABLE "gap_thresholds" ADD COLUMN     "group_id" TEXT;

-- AlterTable
ALTER TABLE "temperature_thresholds" ADD COLUMN     "group_id" TEXT;

-- Data migration: move group IDs from camera_id to group_id
UPDATE "temperature_thresholds"
SET "group_id" = "camera_id", "camera_id" = NULL
WHERE "camera_id" IS NOT NULL
  AND "camera_id" IN (SELECT "id" FROM "groups");

UPDATE "gap_thresholds"
SET "group_id" = "camera_id", "camera_id" = NULL
WHERE "camera_id" IS NOT NULL
  AND "camera_id" IN (SELECT "id" FROM "groups");
