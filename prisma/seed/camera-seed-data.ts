/** Camera definitions grouped by area with realistic base temperatures */
export interface CameraSeed {
  cameraId: string;
  name: string;
  location: string;
  baseTemp: number;
}

const furnaces: CameraSeed[] = Array.from({ length: 10 }, (_, i) => ({
  cameraId: `CAM-${String(i + 1).padStart(3, "0")}`,
  name: `Furnace ${String.fromCharCode(65 + Math.floor(i / 2))} - Zone ${(i % 2) + 1}`,
  location: `Building A - Floor 1`,
  baseTemp: 65 + Math.floor(i / 2) * 3,
}));

const hvac: CameraSeed[] = Array.from({ length: 10 }, (_, i) => ({
  cameraId: `CAM-${String(i + 11).padStart(3, "0")}`,
  name: `HVAC Unit ${i + 1}`,
  location: `Building A - Roof`,
  baseTemp: 35 + (i % 3) * 2,
}));

const serverRooms: CameraSeed[] = Array.from({ length: 10 }, (_, i) => ({
  cameraId: `CAM-${String(i + 21).padStart(3, "0")}`,
  name: `Server Rack ${String.fromCharCode(65 + i)}`,
  location: `Building B - Floor 2 - Data Center`,
  baseTemp: 28 + (i % 4),
}));

const coldStorage: CameraSeed[] = Array.from({ length: 10 }, (_, i) => ({
  cameraId: `CAM-${String(i + 31).padStart(3, "0")}`,
  name: `Cold Storage ${i + 1}`,
  location: `Building C - Basement`,
  baseTemp: -5 + (i % 3) * 2,
}));

const ambient: CameraSeed[] = Array.from({ length: 10 }, (_, i) => ({
  cameraId: `CAM-${String(i + 41).padStart(3, "0")}`,
  name: `Ambient Sensor ${i + 1}`,
  location: `Building ${String.fromCharCode(65 + (i % 3))} - Hallway`,
  baseTemp: 22 + (i % 3),
}));

export const cameraSeedData: CameraSeed[] = [
  ...furnaces,
  ...hvac,
  ...serverRooms,
  ...coldStorage,
  ...ambient,
];
