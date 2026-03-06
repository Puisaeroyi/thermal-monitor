"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Circle } from "lucide-react";

import {
  formatTemperature,
  getTemperatureColor,
} from "@/lib/temperature-utils";

import type { CameraReading } from "@/hooks/use-cameras";
import type { TemperatureThreshold } from "@/types/threshold";
import type { TempUnit } from "@/contexts/temp-unit-context";

import { cn } from "@/lib/utils";

/* STATUS COLOR */

const STATUS_COLOR: Record<string, string> = {
  normal: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  inactive: "#9ca3af",
};

/* GET THRESHOLD */

function getThreshold(
  thresholds: TemperatureThreshold[],
  camera: CameraReading,
) {
  const t = thresholds.find(
    (t) => t.cameraId === camera.cameraId || t.groupId === camera.groupId,
  );

  return {
    warning: t?.minCelsius ?? 60,
    danger: t?.maxCelsius ?? 80,
  };
}

/* PROGRESS SCALE */

const MAX_TEMP = 120; // scale tổng thanh

function getProgress(temp: number | null) {
  if (temp === null) return 0;
  return Math.min((temp / MAX_TEMP) * 100, 100);
}

/* TEMP COLOR */

function getTempColor(status: string) {
  switch (status) {
    case "danger":
      return "text-red-500";
    case "warning":
      return "text-yellow-500";
    case "normal":
      return "text-green-500";
    default:
      return "text-gray-400";
  }
}

/* REALTIME CLOCK */

function formatRealtime(ts: string | null) {
  if (!ts) return "--";

  const date = new Date(ts);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/* PROPS */

interface CameraCardProps {
  camera: CameraReading;
  thresholds: TemperatureThreshold[];
  unit: TempUnit;
}

/* COMPONENT */

const CameraCard = React.memo(function CameraCard({
  camera,
  thresholds,
  unit,
}: CameraCardProps) {
  const router = useRouter();

  const isInactive = camera.status === "INACTIVE";

  const status = isInactive
    ? "inactive"
    : getTemperatureColor(
        camera.celsius,
        thresholds,
        camera.cameraId,
        camera.groupId,
      );

  const color = STATUS_COLOR[status];

  const progress = getProgress(camera.celsius);

  const latestTemp =
    camera.celsius !== null ? formatTemperature(camera.celsius, unit) : "--";

  const realtime = formatRealtime(camera.timestamp);

  const live =
    camera.timestamp &&
    Date.now() - new Date(camera.timestamp).getTime() < 5000;

  /* TREND */

  const trend = React.useMemo(() => {
    if (!camera.history || camera.history.length < 2) return null;

    const last = camera.history[camera.history.length - 1]?.celsius ?? 0;
    const prev = camera.history[camera.history.length - 2]?.celsius ?? 0;

    if (last > prev) return "up";
    if (last < prev) return "down";
    return null;
  }, [camera.history]);

  function handleClick() {
    router.push(`/cameras/${camera.cameraId}`);
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex items-center gap-4 p-3 rounded-lg border bg-background hover:shadow transition cursor-pointer",
        status === "danger" && "border-red-500",
        status === "warning" && "border-yellow-400",
        isInactive && "opacity-70",
      )}
    >
      {/* CAMERA INFO */}

      <div className="w-[220px] flex flex-col">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">{camera.name}</p>

          {/* STATUS DOT */}

          {isInactive ? (
            <span className="flex items-center gap-1 text-red-500 text-xs">
              <Circle size={8} fill="currentColor" />
              OFFLINE
            </span>
          ) : live ? (
            <span className="flex items-center gap-1 text-green-500 text-xs">
              <Circle size={8} fill="currentColor" />
              LIVE
            </span>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground truncate">
          {camera.location}
        </p>

        {/* REALTIME — hidden when offline */}

        {!isInactive && (
          <span className="text-xs text-muted-foreground">{realtime}</span>
        )}
      </div>

      {/* PROGRESS BAR (ẨN NẾU OFFLINE) */}

      {!isInactive && (
        <div className="flex-1 relative h-8 bg-muted rounded overflow-hidden">
          {/* PROGRESS */}

          <div
            className="absolute left-0 top-0 h-full transition-all duration-700 z-0"
            style={{
              width: `${progress}%`,
              background: color,
            }}
          />

          {/* TEMPERATURE */}

          {/* TEMPERATURE */}

          <div className="absolute inset-0 flex items-center justify-end pr-2 z-10">
            <span
              className={cn(
                "text-sm font-bold px-2 py-[2px] rounded",
                "bg-background/80 backdrop-blur-sm",
                getTempColor(status),
              )}
            >
              {latestTemp}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

export { CameraCard };
