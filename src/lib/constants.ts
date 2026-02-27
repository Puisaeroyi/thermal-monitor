/** Polling interval for dashboard refresh (ms) */
export const POLLING_INTERVAL_MS = 5000;

/** Polling interval for alerts (ms) */
export const ALERT_POLLING_INTERVAL_MS = 10000;

/** Max data points on real-time charts */
export const MAX_CHART_POINTS = 360;

/** Default readings query limit */
export const DEFAULT_READINGS_LIMIT = 500;

/** Max readings per batch ingestion */
export const MAX_BATCH_SIZE = 1000;

/** Gap buffer max age in minutes */
export const GAP_BUFFER_MAX_MINUTES = 15;

/** Default cooldown for alerts in minutes */
export const DEFAULT_COOLDOWN_MINUTES = 5;

/** Alerts per page */
export const ALERTS_PAGE_SIZE = 25;

/** Time ranges for charts */
export const TIME_RANGES = [
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "6h", minutes: 360 },
  { label: "24h", minutes: 1440 },
] as const;

export type TimeRangeLabel = (typeof TIME_RANGES)[number]["label"];
