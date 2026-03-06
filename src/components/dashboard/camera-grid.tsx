"use client";

import { CameraCard } from "./camera-card";
import type { TempUnit } from "@/contexts/temp-unit-context";

interface Props {
  cameras: any[];
  thresholds: any;
  unit: TempUnit;
}

export function CameraGrid({ cameras = [], thresholds, unit }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {cameras.map((camera: any) => (
        <CameraCard
          key={camera.cameraId}
          camera={camera}
          thresholds={thresholds}
          unit={unit}
        />
      ))}
    </div>
  );
}