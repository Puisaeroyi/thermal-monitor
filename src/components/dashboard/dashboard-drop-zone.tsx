"use client";

import { useState } from "react";
import { X, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CameraCard } from "@/components/dashboard/camera-card";
import type { DashboardPanel } from "@/hooks/use-dashboard-layout";
import type { CameraReading } from "@/hooks/use-cameras";
import type { TemperatureThreshold } from "@/types/threshold";
import type { TempUnit } from "@/contexts/temp-unit-context";

interface DashboardDropZoneProps {
  panels: DashboardPanel[];
  cameras: CameraReading[];
  thresholds: TemperatureThreshold[];
  unit: TempUnit;
  onDrop: (panel: DashboardPanel) => void;
  onRemove: (panelId: string) => void;
}

/** Single panel section showing cameras for a group or all */
function PanelSection({
  panel,
  cameras,
  thresholds,
  unit,
  onRemove,
}: {
  panel: DashboardPanel;
  cameras: CameraReading[];
  thresholds: TemperatureThreshold[];
  unit: TempUnit;
  onRemove: (id: string) => void;
}) {
  const filtered =
    panel.type === "all"
      ? cameras
      : cameras.filter((c) => c.groupId === panel.groupId);

  const title = panel.type === "all" ? "All Cameras" : panel.groupName || "Group";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {panel.groupColor && (
              <div
                className="size-3 rounded-full"
                style={{ backgroundColor: panel.groupColor }}
              />
            )}
            <CardTitle className="text-base">{title}</CardTitle>
            <span className="text-xs text-muted-foreground">
              {filtered.length} camera{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => onRemove(panel.id)}
            title="Remove panel"
          >
            <X className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No cameras in this group.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
      </CardContent>
    </Card>
  );
}

/** Drop zone canvas — shows panels or an empty state prompt */
export function DashboardDropZone({
  panels,
  cameras,
  thresholds,
  unit,
  onDrop,
  onRemove,
}: DashboardDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    try {
      const data = e.dataTransfer.getData("application/json");
      if (!data) return;
      const panel: DashboardPanel = JSON.parse(data);
      onDrop(panel);
    } catch {
      // Invalid drag data
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        flex-1 min-h-[300px] rounded-xl border-2 border-dashed transition-colors
        ${panels.length > 0 ? "border-transparent" : ""}
        ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20"}
      `}
    >
      {panels.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3 text-muted-foreground">
          <LayoutGrid className="size-12 opacity-30" />
          <p className="text-sm font-medium">Your dashboard is empty</p>
          <p className="text-xs max-w-xs text-center">
            Drag a group or &quot;All Cameras&quot; from the sidebar to start monitoring
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {panels.map((panel) => (
            <PanelSection
              key={panel.id}
              panel={panel}
              cameras={cameras}
              thresholds={thresholds}
              unit={unit}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
