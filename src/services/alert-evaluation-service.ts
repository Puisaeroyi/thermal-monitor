import { GapDirection } from "@/generated/prisma/client";
import { thresholdCache } from "@/services/threshold-cache";
import { gapRingBuffer } from "@/services/gap-ring-buffer";
import { createAlert, hasUncheckedAlert } from "@/services/alert-service";
import type {
  TemperatureThreshold,
  GapThreshold,
} from "@/generated/prisma/client";

/**
 * Evaluate a single reading against all enabled thresholds.
 * Fires alerts where conditions are breached and no unchecked alert exists.
 * Never throws; errors are logged and swallowed.
 */
export async function evaluateReading(
  cameraId: string,
  celsius: number,
  timestamp: Date,
  cameraGroupId?: string | null
): Promise<void> {
  try {
    const tempThresholds =
      (await thresholdCache.getTemperatureThresholds()) as TemperatureThreshold[];
    const applicableTemp = tempThresholds.filter(
      (t) =>
        (t.cameraId === null && t.groupId === null) ||
        t.cameraId === cameraId ||
        (t.groupId !== null && t.groupId === cameraGroupId)
    );

    for (const t of applicableTemp) {
      const breachMin = t.minCelsius !== null && celsius < t.minCelsius;
      const breachMax = t.maxCelsius !== null && celsius > t.maxCelsius;

      if (!breachMin && !breachMax) continue;
      if (await hasUncheckedAlert(t.id, cameraId)) continue;

      const limit = breachMax ? t.maxCelsius : t.minCelsius;
      const message = breachMax
        ? `Above max: ${celsius.toFixed(1)}C > ${Number(limit).toFixed(1)}C (${t.name})`
        : `Below min: ${celsius.toFixed(1)}C < ${Number(limit).toFixed(1)}C (${t.name})`;

      await createAlert({
        cameraId,
        type: "TEMPERATURE",
        message,
        celsius,
        thresholdValue: limit,
        notifyEmail: t.notifyEmail,
        thresholdId: t.id,
      });
    }

    gapRingBuffer.push(cameraId, timestamp, celsius);

    const gapThresholds = (await thresholdCache.getGapThresholds()) as GapThreshold[];
    const applicableGap = gapThresholds.filter(
      (t) =>
        (t.cameraId === null && t.groupId === null) ||
        t.cameraId === cameraId ||
        (t.groupId !== null && t.groupId === cameraGroupId)
    );

    for (const t of applicableGap) {
      const window = gapRingBuffer.getWindow(cameraId, t.intervalMinutes);
      if (!window) continue;

      const delta = window.newest.celsius - window.oldest.celsius;
      const absDelta = Math.abs(delta);

      if (absDelta < t.maxGapCelsius) continue;

      const isRise = delta > 0;
      const isDrop = delta < 0;
      const directionMatches =
        t.direction === GapDirection.BOTH ||
        (t.direction === GapDirection.RISE && isRise) ||
        (t.direction === GapDirection.DROP && isDrop);

      if (!directionMatches) continue;
      if (await hasUncheckedAlert(t.id, cameraId)) continue;

      const message = isRise
        ? `Rise: ${absDelta.toFixed(1)}C/${t.intervalMinutes}m > ${t.maxGapCelsius.toFixed(1)}C (${t.name})`
        : `Drop: ${absDelta.toFixed(1)}C/${t.intervalMinutes}m > ${t.maxGapCelsius.toFixed(1)}C (${t.name})`;

      await createAlert({
        cameraId,
        type: "GAP",
        message,
        celsius,
        thresholdValue: t.maxGapCelsius,
        notifyEmail: t.notifyEmail,
        thresholdId: t.id,
      });
    }
  } catch (err) {
    console.error("[alert-evaluation-service] Error evaluating reading:", err);
  }
}
