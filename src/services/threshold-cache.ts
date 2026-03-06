import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const TEMP_KEY = "thresholds:temp";
const GAP_KEY = "thresholds:gap";
const TTL_SECONDS = 60;

/** Redis-backed threshold cache with TTL-based lazy refresh. */
export const thresholdCache = {
  async getTemperatureThresholds(): Promise<unknown[]> {
    try {
      const cached = await redis.get(TEMP_KEY);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.warn("[threshold-cache] Redis read error, falling back to DB:", err);
    }
    return this.refreshTemperature();
  },

  async getGapThresholds(): Promise<unknown[]> {
    try {
      const cached = await redis.get(GAP_KEY);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.warn("[threshold-cache] Redis read error, falling back to DB:", err);
    }
    return this.refreshGap();
  },

  async refreshTemperature(): Promise<unknown[]> {
    try {
      const data = await prisma.temperatureThreshold.findMany({ where: { enabled: true } });
      await redis.setex(TEMP_KEY, TTL_SECONDS, JSON.stringify(data));
      return data;
    } catch (err) {
      console.error("[threshold-cache] Temperature refresh error:", err);
      return [];
    }
  },

  async refreshGap(): Promise<unknown[]> {
    try {
      const data = await prisma.gapThreshold.findMany({ where: { enabled: true } });
      await redis.setex(GAP_KEY, TTL_SECONDS, JSON.stringify(data));
      return data;
    } catch (err) {
      console.error("[threshold-cache] Gap refresh error:", err);
      return [];
    }
  },

  /** Call after any threshold create/update/delete to force reload on next access. */
  async invalidate(): Promise<void> {
    try {
      await redis.del(TEMP_KEY, GAP_KEY);
    } catch (err) {
      console.warn("[threshold-cache] Redis del error:", err);
    }
  },
};
