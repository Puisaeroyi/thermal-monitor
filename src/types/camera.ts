export interface Camera {
  cameraId: string;
  name: string;
  location: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

/** Camera with latest reading data for dashboard display */
export interface CameraWithReading extends Camera {
  celsius: number | null;
  timestamp: string | null;
}
