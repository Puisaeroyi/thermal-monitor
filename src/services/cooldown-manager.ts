import { redis } from "@/lib/redis";

/** Redis-backed cooldown tracker to prevent alert flooding. */
export const cooldownManager = {
  /** Returns true if enough time has passed since the last alert for this threshold+camera pair. */
  async canAlert(thresholdId: string, cameraId: string): Promise<boolean> {
    const key = `cooldown:${thresholdId}:${cameraId}`;
    try {
      const exists = await redis.exists(key);
      return !exists;
    } catch (err) {
      console.warn("[cooldown-manager] Redis exists error, allowing alert:", err);
      return true;
    }
  },

  /** Records that an alert was fired for this threshold+camera pair right now. */
  async recordAlert(thresholdId: string, cameraId: string, cooldownMinutes: number): Promise<void> {
    const key = `cooldown:${thresholdId}:${cameraId}`;
    try {
      await redis.setex(key, cooldownMinutes * 60, "1");
    } catch (err) {
      console.error("[cooldown-manager] Redis setex error:", err);
    }
  },
};
