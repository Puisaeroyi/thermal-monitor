"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { formatTemperature, getTemperatureColor, getTimeSince } from "@/lib/temperature-utils";
import type { CameraReading } from "@/hooks/use-cameras";
import type { TemperatureThreshold } from "@/types/threshold";
import type { TempUnit } from "@/components/layout/header";
import { cn } from "@/lib/utils";

interface CameraCardProps {
  camera: CameraReading;
  thresholds: TemperatureThreshold[];
  unit: TempUnit;
}

/** Background + border classes per temperature status (light & dark) */
const STATUS_BG: Record<string, string> = {
  normal: "bg-green-50 border-green-200 hover:bg-green-100 dark:bg-green-950/40 dark:border-green-800 dark:hover:bg-green-900/50",
  warning: "bg-yellow-50 border-yellow-300 hover:bg-yellow-100 dark:bg-yellow-950/40 dark:border-yellow-700 dark:hover:bg-yellow-900/50",
  danger: "bg-red-50 border-red-300 hover:bg-red-100 dark:bg-red-950/40 dark:border-red-800 dark:hover:bg-red-900/50",
  inactive: "bg-gray-50 border-gray-200 hover:bg-gray-100 dark:bg-gray-800/40 dark:border-gray-700 dark:hover:bg-gray-800/60",
};

/** Temperature text color per status (light & dark) */
const STATUS_TEMP_COLOR: Record<string, string> = {
  normal: "text-green-700 dark:text-green-400",
  warning: "text-yellow-700 dark:text-yellow-400",
  danger: "text-red-700 dark:text-red-400",
  inactive: "text-gray-400 dark:text-gray-500",
};

/** Clickable camera card showing temperature and status at a glance */
const CameraCard = React.memo(function CameraCard({
  camera,
  thresholds,
  unit,
}: CameraCardProps) {
  const router = useRouter();
  const status = getTemperatureColor(camera.celsius, thresholds, camera.cameraId, camera.groupId);

  function handleClick() {
    router.push(`/cameras/${camera.cameraId}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") handleClick();
  }

  const tempDisplay =
    camera.celsius !== null
      ? formatTemperature(camera.celsius, unit)
      : "No data";

  // Only show timestamp if data is stale (> 5 minutes old) or missing
  const isStale = camera.timestamp
    ? Date.now() - new Date(camera.timestamp).getTime() > 5 * 60 * 1000
    : false;
  const timeSince = camera.timestamp ? getTimeSince(camera.timestamp) : null;
  const showTimestamp = !camera.timestamp || isStale;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "cursor-pointer transition-colors border",
        STATUS_BG[status]
      )}
    >
      <CardContent className="p-4 flex flex-col gap-2">
        {/* Camera name + location */}
        <div>
          <p className="font-semibold text-sm leading-tight truncate">
            {camera.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {camera.location}
          </p>
        </div>

        {/* Large temperature reading (avg) */}
        <div
          className={cn("text-3xl font-bold tabular-nums", STATUS_TEMP_COLOR[status])}
        >
          {tempDisplay}
        </div>

        {/* Min/Max range — only for cameras with range data */}
        {camera.minCelsius != null && camera.maxCelsius != null && (
          <p className="text-xs text-muted-foreground tabular-nums truncate">
            {formatTemperature(camera.minCelsius, unit)} – {formatTemperature(camera.maxCelsius, unit)}
          </p>
        )}

        {/* Last seen timestamp — only show if stale (>5min) or missing */}
        {showTimestamp && (
          <p className="text-xs text-muted-foreground">{timeSince || "—"}</p>
        )}
      </CardContent>
    </Card>
  );
});

export { CameraCard };
