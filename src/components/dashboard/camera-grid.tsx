"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CameraCard } from "@/components/dashboard/camera-card";
import type { CameraReading } from "@/hooks/use-cameras";
import type { TemperatureThreshold } from "@/types/threshold";
import type { TempUnit } from "@/components/layout/header";

interface CameraGridProps {
  cameras: CameraReading[];
  thresholds: TemperatureThreshold[];
  unit: TempUnit;
}

/** Responsive grid of CameraCard components with search filter */
export function CameraGrid({ cameras, thresholds, unit }: CameraGridProps) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? cameras.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.location.toLowerCase().includes(query.toLowerCase())
      )
    : cameras;

  return (
    <div className="flex flex-col gap-4">
      {/* Search filter */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search cameras..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Camera grid */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {query ? "No cameras match your search." : "No cameras available."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((camera) => (
            <CameraCard
              key={camera.cameraId}
              camera={camera}
              thresholds={thresholds}
              unit={unit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
