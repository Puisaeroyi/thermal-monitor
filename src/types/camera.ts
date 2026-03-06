export interface Camera {
  cameraId: string;
  name: string;
  location: string;
  status: "ACTIVE" | "INACTIVE";
  groupId: string | null;
  ipAddress?: string | null;
  modelName?: string | null;
  group?: {
    id: string;
    name: string;
    color: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

/** Camera with latest reading data for dashboard display */
export interface CameraWithReading extends Camera {
  celsius: number | null;
  timestamp: string | null;
}
