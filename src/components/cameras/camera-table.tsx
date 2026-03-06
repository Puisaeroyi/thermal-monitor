"use client";

import { useState } from "react";
import { Camera } from "@/types/camera";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface CameraWithTemp extends Camera {
  celsius?: number | null;
  timestamp?: string | null;
}

interface CameraTableProps {
  cameras: CameraWithTemp[];
  onEdit: (camera: Camera) => void;
  onDelete: (cameraId: string) => void;
  onRefresh: () => void;
}

/** Table listing all cameras with action buttons. */
export function CameraTable({ cameras, onEdit, onDelete, onRefresh }: CameraTableProps) {
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, { ok: boolean; msg: string }>>({});

  async function handleSync(cameraId: string) {
    setSyncingId(cameraId);
    setSyncResults((prev) => ({ ...prev, [cameraId]: { ok: false, msg: "" } }));
    try {
      const res = await fetch("/api/sunapi/device-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cameraId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncResults((prev) => ({ ...prev, [cameraId]: { ok: false, msg: data.error ?? "Failed" } }));
      } else {
        setSyncResults((prev) => ({ ...prev, [cameraId]: { ok: true, msg: `Synced: ${data.model}` } }));
        onRefresh();
      }
    } catch {
      setSyncResults((prev) => ({ ...prev, [cameraId]: { ok: false, msg: "Network error" } }));
    } finally {
      setSyncingId(null);
    }
  }

  if (cameras.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-8 text-center">
        No cameras found. Add one to get started.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Num</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Zone</TableHead>
          <TableHead>IP Address</TableHead>
          <TableHead>Model</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last Updated</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cameras.map((cam, index) => (
          <TableRow key={cam.cameraId}>
            <TableCell className="font-mono text-xs">{index + 1}</TableCell>
            <TableCell className="font-medium">{cam.name}</TableCell>
            <TableCell>{cam.location}</TableCell>
            <TableCell>
              {cam.group ? (
                <Badge variant="outline" style={{ borderColor: cam.group.color }}>
                  {cam.group.name}
                </Badge>
              ) : (
                <span className="text-muted-foreground text-sm">—</span>
              )}
            </TableCell>
            <TableCell className="font-mono text-xs">{cam.ipAddress ?? "—"}</TableCell>
            <TableCell>
              <div className="flex flex-col gap-0.5">
                <span>{cam.modelName ?? "—"}</span>
                {syncResults[cam.cameraId] && (
                  <span className={`text-xs ${syncResults[cam.cameraId].ok ? "text-green-600" : "text-red-500"}`}>
                    {syncResults[cam.cameraId].msg}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={cam.status === "ACTIVE" ? "default" : "secondary"}>
                {cam.status}
              </Badge>
            </TableCell>
            <TableCell>
              {cam.timestamp
                ? new Date(cam.timestamp).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {cam.ipAddress && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSync(cam.cameraId)}
                    disabled={syncingId === cam.cameraId}
                  >
                    <RefreshCw className={`size-3.5 mr-1 ${syncingId === cam.cameraId ? "animate-spin" : ""}`} />
                    Sync
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => onEdit(cam)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onDelete(cam.cameraId)}
                >
                  Delete
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
