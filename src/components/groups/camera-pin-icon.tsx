"use client";

import { useRouter } from "next/navigation";
import { Camera, X } from "lucide-react";
import { useState } from "react";

interface CameraPinIconProps {
  pinId: string;
  cameraId: string;
  cameraName: string;
  status: "ACTIVE" | "INACTIVE";
  x: number;
  y: number;
  onDelete: (pinId: string) => void;
}

export function CameraPinIcon({
  pinId,
  cameraId,
  cameraName,
  status,
  x,
  y,
  onDelete,
}: CameraPinIconProps) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const isActive = status === "ACTIVE";

  return (
    <div
      className="absolute z-10 group"
      style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Delete button */}
      {hovered && (
        <button
          className="absolute -top-2 -right-2 z-20 bg-destructive text-destructive-foreground rounded-full p-0.5 hover:scale-110 transition-transform"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(pinId);
          }}
          title="Remove pin"
        >
          <X className="size-3" />
        </button>
      )}

      {/* Pin icon */}
      <button
        className={`flex items-center justify-center size-7 rounded-full border-2 shadow-md transition-transform hover:scale-110 cursor-pointer ${
          isActive
            ? "bg-green-500/90 border-green-600 text-white"
            : "bg-gray-400/90 border-gray-500 text-white"
        }`}
        onClick={() => router.push(`/cameras/${cameraId}`)}
        title={cameraName}
      >
        <Camera className="size-3.5" />
      </button>

      {/* Label on hover */}
      {hovered && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md border">
          {cameraName}
        </div>
      )}
    </div>
  );
}
