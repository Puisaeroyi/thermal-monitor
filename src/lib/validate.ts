import { MAX_BATCH_SIZE } from "@/lib/constants";

export interface CameraInput {
  cameraId: string;
  name: string;
  location: string;
  status?: "ACTIVE" | "INACTIVE";
  groupId?: string | null;
  ipAddress?: string | null;
  port?: number;
  username?: string | null;
  password?: string | null;
  modelName?: string | null;
}

export interface ReadingInput {
  cameraId: string;
  celsius: number;
  maxCelsius?: number;
  minCelsius?: number;
  timestamp: string;
}

export interface TemperatureThresholdInput {
  name: string;
  cameraId?: string | null;
  groupId?: string | null;
  minCelsius?: number | null;
  maxCelsius?: number | null;
  cooldownMinutes?: number;
  notifyEmail?: boolean;
  enabled?: boolean;
}

export interface GapThresholdInput {
  name: string;
  cameraId?: string | null;
  groupId?: string | null;
  intervalMinutes: number;
  maxGapCelsius: number;
  direction?: "RISE" | "DROP" | "BOTH";
  cooldownMinutes?: number;
  notifyEmail?: boolean;
  enabled?: boolean;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateCameraInput(
  data: unknown,
  requireId = true
): CameraInput {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }
  const d = data as Record<string, unknown>;

  if (requireId) {
    if (!d.cameraId || typeof d.cameraId !== "string") {
      throw new ValidationError("cameraId must be a non-empty string");
    }
  }
  if (!d.name || typeof d.name !== "string") {
    throw new ValidationError("name must be a non-empty string");
  }
  if (!d.location || typeof d.location !== "string") {
    throw new ValidationError("location must be a non-empty string");
  }
  if (d.status !== undefined && d.status !== "ACTIVE" && d.status !== "INACTIVE") {
    throw new ValidationError("status must be ACTIVE or INACTIVE");
  }

  return {
    cameraId: d.cameraId as string,
    name: d.name as string,
    location: d.location as string,
    status: d.status as "ACTIVE" | "INACTIVE" | undefined,
    groupId: d.groupId as string | null | undefined,
    ipAddress: (d.ipAddress as string | null | undefined) ?? null,
    port: typeof d.port === "number" ? d.port : undefined,
    username: (d.username as string | null | undefined) ?? null,
    password: (d.password as string | null | undefined) ?? null,
    modelName: (d.modelName as string | null | undefined) ?? null,
  };
}

export function validateReadingInput(data: unknown): ReadingInput {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Reading must be an object");
  }
  const d = data as Record<string, unknown>;

  if (!d.cameraId || typeof d.cameraId !== "string") {
    throw new ValidationError("cameraId must be a non-empty string");
  }
  if (typeof d.celsius !== "number" || !isFinite(d.celsius)) {
    throw new ValidationError("celsius must be a finite number");
  }
  if (!d.timestamp || typeof d.timestamp !== "string") {
    throw new ValidationError("timestamp must be an ISO string");
  }
  const ts = new Date(d.timestamp);
  if (isNaN(ts.getTime())) {
    throw new ValidationError("timestamp must be a valid ISO date string");
  }

  if (d.maxCelsius !== undefined && typeof d.maxCelsius !== "number") {
    throw new ValidationError("maxCelsius must be a number");
  }
  if (d.maxCelsius !== undefined && !isFinite(d.maxCelsius as number)) {
    throw new ValidationError("maxCelsius must be a finite number");
  }
  if (d.minCelsius !== undefined && typeof d.minCelsius !== "number") {
    throw new ValidationError("minCelsius must be a number");
  }
  if (d.minCelsius !== undefined && !isFinite(d.minCelsius as number)) {
    throw new ValidationError("minCelsius must be a finite number");
  }

  return {
    cameraId: d.cameraId as string,
    celsius: d.celsius as number,
    ...(d.maxCelsius !== undefined && { maxCelsius: d.maxCelsius as number }),
    ...(d.minCelsius !== undefined && { minCelsius: d.minCelsius as number }),
    timestamp: d.timestamp as string,
  };
}

export function validateReadingBatch(data: unknown): ReadingInput[] {
  if (!Array.isArray(data)) {
    throw new ValidationError("Readings must be an array");
  }
  if (data.length === 0) {
    throw new ValidationError("Readings array must not be empty");
  }
  if (data.length > MAX_BATCH_SIZE) {
    throw new ValidationError(
      `Batch size exceeds maximum of ${MAX_BATCH_SIZE}`
    );
  }
  return data.map((item, i) => {
    try {
      return validateReadingInput(item);
    } catch (e) {
      throw new ValidationError(
        `Reading at index ${i}: ${(e as Error).message}`
      );
    }
  });
}

/** Input from Python RTSP collector script */
export interface TemperatureReadingInput {
  ts_utc: string;
  camera: string;
  host: string;
  roi: string;
  max_temperature: number | null;
  unit: string;
  status?: string;
}

/** Validate a single temperature reading from the collector script */
export function validateTemperatureReading(data: unknown): TemperatureReadingInput {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Temperature reading must be an object");
  }
  const d = data as Record<string, unknown>;

  if (!d.ts_utc || typeof d.ts_utc !== "string") {
    throw new ValidationError("ts_utc must be a non-empty string");
  }
  const ts = new Date(d.ts_utc);
  if (isNaN(ts.getTime())) {
    throw new ValidationError("ts_utc must be a valid ISO date string");
  }
  if (!d.camera || typeof d.camera !== "string") {
    throw new ValidationError("camera must be a non-empty string");
  }
  if (!d.host || typeof d.host !== "string") {
    throw new ValidationError("host must be a non-empty string");
  }

  // Temperature values can be null (camera failure)
  for (const key of ["max_temperature"] as const) {
    if (d[key] !== null && d[key] !== undefined && typeof d[key] !== "number") {
      throw new ValidationError(`${key} must be a number or null`);
    }
  }

  return {
    ts_utc: d.ts_utc as string,
    camera: d.camera as string,
    host: d.host as string,
    roi: (d.roi as string) || "UNKNOWN",
    max_temperature: (d.max_temperature as number | null) ?? null,
    unit: (d.unit as string) || "Fahrenheit",
    status: d.status as string | undefined,
  };
}

/** Validate a batch of temperature readings from the collector script */
export function validateTemperatureReadingBatch(data: unknown): TemperatureReadingInput[] {
  if (!Array.isArray(data)) {
    throw new ValidationError("Temperature readings must be an array");
  }
  if (data.length === 0) {
    throw new ValidationError("Temperature readings array must not be empty");
  }
  if (data.length > MAX_BATCH_SIZE) {
    throw new ValidationError(`Batch size exceeds maximum of ${MAX_BATCH_SIZE}`);
  }
  return data.map((item, i) => {
    try {
      return validateTemperatureReading(item);
    } catch (e) {
      throw new ValidationError(`Reading at index ${i}: ${(e as Error).message}`);
    }
  });
}

export function validateTemperatureThresholdInput(
  data: unknown
): TemperatureThresholdInput {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }
  const d = data as Record<string, unknown>;

  if (!d.name || typeof d.name !== "string") {
    throw new ValidationError("name must be a non-empty string");
  }
  if (d.minCelsius !== undefined && d.minCelsius !== null && typeof d.minCelsius !== "number") {
    throw new ValidationError("minCelsius must be a number or null");
  }
  if (d.maxCelsius !== undefined && d.maxCelsius !== null && typeof d.maxCelsius !== "number") {
    throw new ValidationError("maxCelsius must be a number or null");
  }
  if (d.cooldownMinutes !== undefined && (typeof d.cooldownMinutes !== "number" || d.cooldownMinutes < 0)) {
    throw new ValidationError("cooldownMinutes must be a non-negative number");
  }

  return {
    name: d.name as string,
    cameraId: d.cameraId as string | null | undefined,
    groupId: d.groupId as string | null | undefined,
    minCelsius: d.minCelsius as number | null | undefined,
    maxCelsius: d.maxCelsius as number | null | undefined,
    cooldownMinutes: d.cooldownMinutes as number | undefined,
    notifyEmail: d.notifyEmail as boolean | undefined,
    enabled: d.enabled as boolean | undefined,
  };
}

export function validateGapThresholdInput(data: unknown): GapThresholdInput {
  if (!data || typeof data !== "object") {
    throw new ValidationError("Request body must be an object");
  }
  const d = data as Record<string, unknown>;

  if (!d.name || typeof d.name !== "string") {
    throw new ValidationError("name must be a non-empty string");
  }
  if (typeof d.intervalMinutes !== "number" || d.intervalMinutes <= 0) {
    throw new ValidationError("intervalMinutes must be a positive number");
  }
  if (typeof d.maxGapCelsius !== "number" || d.maxGapCelsius < 0) {
    throw new ValidationError("maxGapCelsius must be a non-negative number");
  }
  if (
    d.direction !== undefined &&
    d.direction !== "RISE" &&
    d.direction !== "DROP" &&
    d.direction !== "BOTH"
  ) {
    throw new ValidationError("direction must be RISE, DROP, or BOTH");
  }

  return {
    name: d.name as string,
    cameraId: d.cameraId as string | null | undefined,
    groupId: d.groupId as string | null | undefined,
    intervalMinutes: d.intervalMinutes as number,
    maxGapCelsius: d.maxGapCelsius as number,
    direction: d.direction as "RISE" | "DROP" | "BOTH" | undefined,
    cooldownMinutes: d.cooldownMinutes as number | undefined,
    notifyEmail: d.notifyEmail as boolean | undefined,
    enabled: d.enabled as boolean | undefined,
  };
}
