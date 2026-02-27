"use client";

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

interface CameraWithTemp extends Camera {
  celsius?: number | null;
  timestamp?: string | null;
}

interface CameraTableProps {
  cameras: CameraWithTemp[];
  onEdit: (camera: Camera) => void;
  onDelete: (cameraId: string) => void;
}

/** Table listing all cameras with latest temperature and action buttons. */
export function CameraTable({ cameras, onEdit, onDelete }: CameraTableProps) {
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
          <TableHead>ID</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Group</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last Temp</TableHead>
          <TableHead>Last Updated</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cameras.map((cam) => (
          <TableRow key={cam.cameraId}>
            <TableCell className="font-mono text-xs">{cam.cameraId}</TableCell>
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
            <TableCell>
              <Badge variant={cam.status === "ACTIVE" ? "default" : "secondary"}>
                {cam.status}
              </Badge>
            </TableCell>
            <TableCell>
              {cam.celsius != null ? `${cam.celsius.toFixed(1)}°C` : "—"}
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
