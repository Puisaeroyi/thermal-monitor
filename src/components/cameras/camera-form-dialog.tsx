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
import { Wifi, WifiOff, Loader2 } from "lucide-react";

interface CameraFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  camera?: Camera | null;
  groups: { id: string; name: string; cameraCount: number }[];
  onSuccess: () => void;
}

interface CameraForm {
  name: string;
  location: string;
  status: "ACTIVE" | "INACTIVE";
  groupId: string;
  ipAddress: string;
  port: string;
  username: string;
  password: string;
  modelName: string;
}

const EMPTY_FORM: CameraForm = {
  name: "",
  location: "",
  status: "ACTIVE",
  groupId: "none",
  ipAddress: "",
  port: "80",
  username: "",
  password: "",
  modelName: "",
};

/** Dialog for creating a new camera or editing an existing one. */
export function CameraFormDialog({ open, onOpenChange, camera, groups, onSuccess }: CameraFormDialogProps) {
  const isEdit = Boolean(camera);
  const [form, setForm] = useState<CameraForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionTested, setConnectionTested] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (camera) {
      setForm({
        name: camera.name,
        location: camera.location,
        status: camera.status,
        groupId: camera.groupId || "none",
        ipAddress: camera.ipAddress ?? "",
        port: String(camera.port ?? 80),
        username: camera.username ?? "",
        password: camera.password ?? "",
        modelName: camera.modelName ?? "",
      });
      setConnectionTested(true); // existing cameras don't need re-testing
    } else {
      setForm(EMPTY_FORM);
      setConnectionTested(false);
    }
    setError(null);
    setTestResult(null);
  }, [camera, open]);

  // Reset connection test when IP or port changes
  function updateField(field: keyof CameraForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === "ipAddress" || field === "port") {
      setConnectionTested(false);
      setTestResult(null);
    }
  }

  async function handleTestConnection() {
    if (!form.ipAddress) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/cameras/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ipAddress: form.ipAddress, port: Number(form.port) || 80 }),
      });
      const data = await res.json();
      if (data.success) {
        setConnectionTested(true);
        setTestResult({ success: true, message: `Connected (HTTP ${data.status})` });
      } else {
        setConnectionTested(false);
        setTestResult({ success: false, message: data.error || "Connection failed" });
      }
    } catch {
      setConnectionTested(false);
      setTestResult({ success: false, message: "Request failed" });
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const portNum = Number(form.port) || 80;
      const url = isEdit ? `/api/cameras/${camera!.cameraId}` : "/api/cameras";
      const method = isEdit ? "PUT" : "POST";
      const body = {
        ...(!isEdit && { cameraId: `cam-${Date.now()}` }),
        name: form.name,
        location: form.location,
        groupId: form.groupId === "none" ? null : form.groupId,
        ipAddress: form.ipAddress || null,
        port: portNum,
        username: form.username || null,
        password: form.password || null,
        modelName: form.modelName || null,
      };
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

  const canSubmit = isEdit || connectionTested;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Camera" : "Add Camera"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Server Room A"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={form.location}
              onChange={(e) => updateField("location", e.target.value)}
              placeholder="Building 1, Floor 2"
              required
            />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <Label htmlFor="ipAddress">IP Address</Label>
              <Input
                id="ipAddress"
                value={form.ipAddress}
                onChange={(e) => updateField("ipAddress", e.target.value)}
                placeholder="192.168.1.100"
                required={!isEdit}
              />
            </div>
            <div className="flex flex-col gap-1.5 w-24">
              <Label htmlFor="port">Port</Label>
              <Select value={form.port} onValueChange={(v) => updateField("port", v)}>
                <SelectTrigger id="port">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="80">80</SelectItem>
                  <SelectItem value="443">443</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Test Connection */}
          {!isEdit && (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!form.ipAddress || testing}
                onClick={handleTestConnection}
              >
                {testing ? (
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                ) : connectionTested ? (
                  <Wifi className="size-4 mr-1.5 text-green-500" />
                ) : (
                  <WifiOff className="size-4 mr-1.5" />
                )}
                Test Connection
              </Button>
              {testResult && (
                <span className={`text-xs ${testResult.success ? "text-green-600" : "text-destructive"}`}>
                  {testResult.message}
                </span>
              )}
            </div>
          )}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(e) => updateField("username", e.target.value)}
                placeholder="admin"
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="modelName">Model Name</Label>
            <Input
              id="modelName"
              value={form.modelName}
              onChange={(e) => updateField("modelName", e.target.value)}
              placeholder="e.g., FLIR A320"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group">Group</Label>
            <Select
              value={form.groupId}
              onValueChange={(v) => updateField("groupId", v)}
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
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !canSubmit}>
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Camera"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
