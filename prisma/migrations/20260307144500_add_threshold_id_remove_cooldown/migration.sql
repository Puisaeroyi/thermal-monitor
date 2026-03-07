-- AlterTable - Add threshold_id to alerts
ALTER TABLE "alerts" ADD COLUMN "threshold_id" TEXT;

-- AlterTable - Drop cooldown_minutes from temperature_thresholds
ALTER TABLE "temperature_thresholds" DROP COLUMN "cooldown_minutes";

-- AlterTable - Drop cooldown_minutes from gap_thresholds
ALTER TABLE "gap_thresholds" DROP COLUMN "cooldown_minutes";

-- CreateIndex - For fast unchecked-alert lookup
CREATE INDEX "alerts_threshold_id_camera_id_acknowledged_idx" ON "alerts"("threshold_id", "camera_id", "acknowledged");
