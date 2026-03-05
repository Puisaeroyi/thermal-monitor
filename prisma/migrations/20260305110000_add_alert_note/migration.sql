-- Add operator note field for checked alerts
ALTER TABLE "alerts"
ADD COLUMN "note" TEXT;
