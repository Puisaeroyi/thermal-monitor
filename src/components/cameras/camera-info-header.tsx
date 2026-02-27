"use client";

import { Camera } from "@/types/camera";
import { Reading } from "@/types/reading";
import { Badge } from "@/components/ui/badge";

interface CameraInfoHeaderProps {
  camera: Camera;
  latestReading: Reading | null;
}

/** Displays camera identity, status badge, current temperature, and last update time. */
export function CameraInfoHeader({ camera, latestReading }: CameraInfoHeaderProps) {
  const lastUpdated = latestReading
    ? new Date(latestReading.timestamp).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "No data";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{camera.name}</h1>
          <Badge variant={camera.status === "ACTIVE" ? "default" : "secondary"}>
            {camera.status}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">{camera.location}</p>
        <p className="text-xs text-muted-foreground">ID: {camera.cameraId}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        {latestReading != null ? (
          <span className="text-5xl font-bold tabular-nums">
            {latestReading.celsius.toFixed(1)}°C
          </span>
        ) : (
          <span className="text-3xl font-bold text-muted-foreground">—</span>
        )}
        <span className="text-xs text-muted-foreground">Last updated: {lastUpdated}</span>
      </div>
    </div>
  );
}
