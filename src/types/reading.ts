export interface Reading {
  id: string;
  cameraId: string;
  celsius: number;
  timestamp: string;
}

export interface ReadingInput {
  cameraId: string;
  celsius: number;
  timestamp?: string;
}

export interface ReadingsQuery {
  cameraId?: string;
  from?: string;
  to?: string;
  limit?: number;
}
