"use client";

import { useState, useEffect } from "react";
import { Camera } from "@/types/camera";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CameraFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  camera?: Camera | null;
  groups: { id: string; name: string; cameraCount: number }[];
  onSuccess: () => void;
}

interface CameraForm {
  cameraId: string;
  name: string;
  location: string;
  status: "ACTIVE" | "INACTIVE";
  groupId: string;
}

const EMPTY_FORM: CameraForm = { cameraId: "", name: "", location: "", status: "ACTIVE", groupId: "none" };

/** Dialog for creating a new camera or editing an existing one. */
export function CameraFormDialog({ open, onOpenChange, camera, groups, onSuccess }: CameraFormDialogProps) {
  const isEdit = Boolean(camera);
  const [form, setForm] = useState<CameraForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (camera) {
      setForm({ cameraId: camera.cameraId, name: camera.name, location: camera.location, status: camera.status, groupId: camera.groupId || "none" });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [camera, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const url = isEdit ? `/api/cameras/${camera!.cameraId}` : "/api/cameras";
      const method = isEdit ? "PUT" : "POST";
      const body = isEdit
        ? { name: form.name, location: form.location, status: form.status, groupId: form.groupId === "none" ? null : form.groupId }
        : { cameraId: form.cameraId, name: form.name, location: form.location, groupId: form.groupId === "none" ? null : form.groupId };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Camera" : "Add Camera"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isEdit && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cameraId">Camera ID</Label>
              <Input
                id="cameraId"
                value={form.cameraId}
                onChange={(e) => setForm((f) => ({ ...f, cameraId: e.target.value }))}
                placeholder="cam-001"
                required
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Server Room A"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Building 1, Floor 2"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group">Group</Label>
            <Select
              value={form.groupId}
              onValueChange={(v) => setForm((f) => ({ ...f, groupId: v }))}
            >
              <SelectTrigger id="group">
                <SelectValue placeholder="No group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No group</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isEdit && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as "ACTIVE" | "INACTIVE" }))}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Camera"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
