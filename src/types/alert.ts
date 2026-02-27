export type AlertType = "TEMPERATURE" | "GAP";

export interface Alert {
  id: string;
  cameraId: string;
  type: AlertType;
  message: string;
  celsius: number;
  thresholdValue: number | null;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
}

export interface AlertsQuery {
  cameraId?: string;
  type?: AlertType;
  acknowledged?: boolean;
  from?: string;
  to?: string;
  since?: string;
  page?: number;
  limit?: number;
}
