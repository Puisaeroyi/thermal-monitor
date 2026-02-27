import { GapDirection } from "@/generated/prisma/client";
import { cooldownManager } from "@/services/cooldown-manager";
import { thresholdCache } from "@/services/threshold-cache";
import { gapRingBuffer } from "@/services/gap-ring-buffer";
import { createAlert } from "@/services/alert-service";

/**
 * Evaluate a single reading against all enabled thresholds.
 * Fires alerts where conditions are breached and cooldowns allow.
 * Never throws — errors are logged and swallowed.
 */
export async function evaluateReading(
  cameraId: string,
  celsius: number,
  timestamp: Date
): Promise<void> {
  try {
    // ── Temperature thresholds ───────────────────────────────────────────────
    const tempThresholds = await thresholdCache.getTemperatureThresholds();
    const applicableTemp = tempThresholds.filter(
      (t) => t.cameraId === null || t.cameraId === cameraId
    );

    for (const t of applicableTemp) {
      const breachMin = t.minCelsius !== null && celsius < t.minCelsius;
      const breachMax = t.maxCelsius !== null && celsius > t.maxCelsius;

      if (!breachMin && !breachMax) continue;
      if (!cooldownManager.canAlert(t.id, cameraId, t.cooldownMinutes)) continue;

      const limit = breachMax ? t.maxCelsius : t.minCelsius;
      const dir = breachMax ? "above" : "below";
      const message = `Temperature ${celsius.toFixed(2)}°C is ${dir} threshold (${limit}°C) — ${t.name}`;

      await createAlert({
        cameraId,
        type: "TEMPERATURE",
        message,
        celsius,
        thresholdValue: limit,
        notifyEmail: t.notifyEmail,
        thresholdId: t.id,
      });

      cooldownManager.recordAlert(t.id, cameraId);
    }

    // ── Gap buffer push ──────────────────────────────────────────────────────
    gapRingBuffer.push(cameraId, timestamp, celsius);

    // ── Gap thresholds ───────────────────────────────────────────────────────
    const gapThresholds = await thresholdCache.getGapThresholds();
    const applicableGap = gapThresholds.filter(
      (t) => t.cameraId === null || t.cameraId === cameraId
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
      if (!cooldownManager.canAlert(t.id, cameraId, t.cooldownMinutes)) continue;

      const dir = isRise ? "rose" : "dropped";
      const message = `Temperature ${dir} ${absDelta.toFixed(2)}°C in ${t.intervalMinutes}min (limit ${t.maxGapCelsius}°C) — ${t.name}`;

      await createAlert({
        cameraId,
        type: "GAP",
        message,
        celsius,
        thresholdValue: t.maxGapCelsius,
        notifyEmail: t.notifyEmail,
        thresholdId: t.id,
      });

      cooldownManager.recordAlert(t.id, cameraId);
    }
  } catch (err) {
    console.error("[alert-evaluation-service] Error evaluating reading:", err);
  }
}
