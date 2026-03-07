export interface TemperatureThreshold {
  id: string;
  name: string;
  cameraId: string | null;
  groupId: string | null;
  minCelsius: number | null;
  maxCelsius: number | null;
  notifyEmail: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type GapDirection = "RISE" | "DROP" | "BOTH";

export interface GapThreshold {
  id: string;
  name: string;
  cameraId: string | null;
  groupId: string | null;
  intervalMinutes: number;
  maxGapCelsius: number;
  direction: GapDirection;
  notifyEmail: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}
