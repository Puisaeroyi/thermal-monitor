import type { TemperatureThreshold } from "@/types/threshold";

/** Temperature status levels for color coding */
export type TemperatureStatus = "normal" | "warning" | "danger" | "inactive";

/** Convert Celsius to Fahrenheit, rounded to 1 decimal */
export function celsiusToFahrenheit(c: number): number {
  return Math.round(((c * 9) / 5 + 32) * 10) / 10;
}

/** Convert Fahrenheit to Celsius, rounded to 1 decimal */
export function fahrenheitToCelsius(f: number): number {
  return Math.round(((f - 32) * 5 / 9) * 10) / 10;
}

/** Format temperature value with degree symbol and unit */
export function formatTemperature(celsius: number, unit: "C" | "F"): string {
  if (unit === "F") {
    const f = celsiusToFahrenheit(celsius);
    return `${f}°F`;
  }
  return `${Math.round(celsius * 10) / 10}°C`;
}

/**
 * Determine temperature status based on thresholds.
 * Returns 'inactive' if celsius is null, 'danger' if above maxCelsius,
 * 'warning' approaching max, 'normal' otherwise.
 * Filters thresholds by scope: global, group-specific, or camera-specific.
 */
export function getTemperatureColor(
  celsius: number | null,
  thresholds: TemperatureThreshold[],
  cameraId?: string,
  groupId?: string | null
): TemperatureStatus {
  if (celsius === null) return "inactive";

  // Filter thresholds by enabled status AND scope
  const applicable = thresholds.filter((t) => {
    if (!t.enabled) return false;
    // Global threshold (no camera or group scope)
    if (t.cameraId === null && t.groupId === null) return true;
    // Camera-specific
    if (t.cameraId !== null && t.cameraId === cameraId) return true;
    // Group-scoped
    if (t.groupId !== null && t.groupId === groupId) return true;
    return false;
  });

  let isDanger = false;
  let isWarning = false;

  for (const t of applicable) {
    if (t.maxCelsius !== null && celsius > t.maxCelsius) {
      isDanger = true;
      break;
    }
    if (t.minCelsius !== null && celsius < t.minCelsius) {
      isDanger = true;
      break;
    }
    // Warning zone: within 10% of max threshold
    if (t.maxCelsius !== null && celsius > t.maxCelsius * 0.9) {
      isWarning = true;
    }
  }

  if (isDanger) return "danger";
  if (isWarning) return "warning";
  return "normal";
}

/** Return human-readable time since a timestamp string */
export function getTimeSince(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
