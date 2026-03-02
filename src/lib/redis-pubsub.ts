import { redisPub } from "@/lib/redis";

/** Publish latest readings to Redis channel for SSE distribution. */
export async function publishReadings(readings: unknown[]): Promise<void> {
  try {
    await redisPub.publish("readings:latest", JSON.stringify(readings));
  } catch (err) {
    console.error("[redis-pubsub] Publish readings error:", err);
  }
}

/** Publish new alert to Redis channel for SSE distribution. */
export async function publishAlert(alert: unknown): Promise<void> {
  try {
    await redisPub.publish("alerts:new", JSON.stringify(alert));
  } catch (err) {
    console.error("[redis-pubsub] Publish alert error:", err);
  }
}

/** Publish threshold invalidation event to notify other instances. */
export async function publishThresholdInvalidation(): Promise<void> {
  try {
    await redisPub.publish("thresholds:invalidate", "1");
  } catch (err) {
    console.error("[redis-pubsub] Threshold invalidation publish error:", err);
  }
}
