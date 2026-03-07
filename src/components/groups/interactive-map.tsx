"use client";

import { useState, useCallback } from "react";
import { MapPin } from "lucide-react";
import { CameraPinIcon } from "@/components/groups/camera-pin-icon";
import { PinPlacementDialog } from "@/components/groups/pin-placement-dialog";

interface CameraInfo {
  cameraId: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
}

interface Pin {
  id: string;
  cameraId: string;
  x: number;
  y: number;
  camera: CameraInfo;
}

interface InteractiveMapProps {
  groupId: string;
  mapImage: string | null;
  pins: Pin[];
  cameras: { cameraId: string; name: string }[];
  onPinsChange: (pins: Pin[]) => void;
}

export function InteractiveMap({
  groupId,
  mapImage,
  pins,
  cameras,
  onPinsChange,
}: InteractiveMapProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string | undefined>(undefined);

  // Cameras not yet pinned
  const pinnedIds = new Set(pins.map((p) => p.cameraId));
  const availableCameras = cameras.filter((c) => !pinnedIds.has(c.cameraId));

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (availableCameras.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setClickPos({ x, y });
      setDialogOpen(true);
    },
    [availableCameras.length]
  );

  async function handleConfirm(cameraId: string) {
    if (!clickPos) return;
    setDialogOpen(false);
    try {
      const res = await fetch(`/api/groups/${groupId}/pins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cameraId, x: clickPos.x, y: clickPos.y }),
      });
      if (!res.ok) throw new Error("Failed to create pin");
      const pin: Pin = await res.json();
      onPinsChange([...pins, pin]);
    } catch (err) {
      console.error("Create pin error:", err);
    }
    setClickPos(null);
  }

  async function handleDeletePin(pinId: string) {
    try {
      const res = await fetch(`/api/groups/${groupId}/pins/${pinId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete pin");
      onPinsChange(pins.filter((p) => p.id !== pinId));
    } catch (err) {
      console.error("Delete pin error:", err);
    }
  }

  if (!mapImage) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <MapPin className="size-10 opacity-50" />
        <p className="text-sm">No map uploaded. Use the upload button above.</p>
      </div>
    );
  }

  return (
    <>
      {/* Outer wrapper centers the aspect-ratio-constrained map */}
      <div className="flex items-center justify-center w-full h-full">
        <div
          className="relative select-none max-w-full max-h-full"
          style={aspectRatio ? { aspectRatio } : { width: "100%", height: "100%" }}
          onDoubleClick={handleDoubleClick}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mapImage}
            alt="Zone Map"
            className="w-full h-full object-contain rounded-md"
            onLoad={(e) => {
              const img = e.currentTarget;
              setAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`);
            }}
          />
          {pins.map((pin) => (
            <CameraPinIcon
              key={pin.id}
              pinId={pin.id}
              cameraId={pin.cameraId}
              cameraName={pin.camera.name}
              status={pin.camera.status as "ACTIVE" | "INACTIVE"}
              x={pin.x}
              y={pin.y}
              onDelete={handleDeletePin}
            />
          ))}
        </div>
      </div>

      <PinPlacementDialog
        open={dialogOpen}
        cameras={availableCameras}
        onConfirm={handleConfirm}
        onCancel={() => {
          setDialogOpen(false);
          setClickPos(null);
        }}
      />
    </>
  );
}
