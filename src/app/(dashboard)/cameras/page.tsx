"use client";

import { useState, useEffect, useCallback } from "react";
import { Camera } from "@/types/camera";
import { CameraTable } from "@/components/cameras/camera-table";
import { CameraFormDialog } from "@/components/cameras/camera-form-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CameraWithTemp extends Camera {
  celsius?: number | null;
  timestamp?: string | null;
}

interface Group {
  id: string;
  name: string;
  cameraCount: number;
}

/** Camera management page — list, add, edit, delete cameras. */
export default function CamerasPage() {
  const [cameras, setCameras] = useState<CameraWithTemp[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCamera, setEditCamera] = useState<Camera | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupColor, setGroupColor] = useState("#6b7280");

  const fetchCameras = useCallback(async () => {
    try {
      const [camsRes, latestRes, groupsRes] = await Promise.all([
        fetch("/api/cameras"),
        fetch("/api/readings/latest"),
        fetch("/api/groups"),
      ]);
      const cams: Camera[] = camsRes.ok ? await camsRes.json() : [];
      const latest: { cameraId: string; celsius: number; timestamp: string }[] =
        latestRes.ok ? await latestRes.json() : [];
      const groupsData: Group[] = groupsRes.ok ? await groupsRes.json() : [];
      const latestMap = new Map(latest.map((r) => [r.cameraId, r]));
      const merged: CameraWithTemp[] = cams.map((c) => ({
        ...c,
        celsius: latestMap.get(c.cameraId)?.celsius ?? null,
        timestamp: latestMap.get(c.cameraId)?.timestamp ?? null,
      }));
      setCameras(merged);
      setGroups(groupsData);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCameras();
    const id = setInterval(fetchCameras, 10000);
    return () => clearInterval(id);
  }, [fetchCameras]);

  function handleEdit(camera: Camera) {
    setEditCamera(camera);
    setDialogOpen(true);
  }

  async function handleDelete(cameraId: string) {
    if (!confirm(`Delete camera "${cameraId}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/cameras/${encodeURIComponent(cameraId)}`, {
        method: "DELETE",
      });
      fetchCameras();
    } catch {
      // silent
    }
  }

  function handleAddClick() {
    setEditCamera(null);
    setDialogOpen(true);
  }

  function handleAddGroupClick() {
    setGroupName("");
    setGroupColor("#6b7280");
    setGroupDialogOpen(true);
  }

  async function handleGroupSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName, color: groupColor }),
      });
      if (res.ok) {
        setGroupDialogOpen(false);
        fetchCameras();
      }
    } catch {
      // silent
    }
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cameras</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAddGroupClick}>
            Export Excel
          </Button>
          <Button variant="outline" onClick={handleAddGroupClick}>
            Add Group
          </Button>
          <Button onClick={handleAddClick}>Add Camera</Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading cameras…</p>
      ) : (
        <CameraTable
          cameras={cameras}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      <CameraFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditCamera(null);
        }}
        camera={editCamera}
        groups={groups}
        onSuccess={fetchCameras}
      />
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Group</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGroupSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="group-name">Name</Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g., Furnaces"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="group-color">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="group-color"
                  type="color"
                  value={groupColor}
                  onChange={(e) => setGroupColor(e.target.value)}
                  className="w-16 h-10"
                />
                <Input
                  type="text"
                  value={groupColor}
                  onChange={(e) => setGroupColor(e.target.value)}
                  placeholder="#6b7280"
                  className="flex-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setGroupDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
