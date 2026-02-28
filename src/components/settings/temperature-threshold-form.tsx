"use client";

import { useState, useEffect } from "react";
import { TemperatureThreshold } from "@/types/threshold";
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
import { Switch } from "@/components/ui/switch";

interface TempThresholdFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threshold?: TemperatureThreshold | null;
  groups: { id: string; name: string; cameraCount: number }[];
  onSuccess: () => void;
}

interface TempForm {
  name: string;
  scope: string; // "all" for global, "group-{id}" for group
  minCelsius: string;
  maxCelsius: string;
  cooldownMinutes: string;
  enabled: boolean;
}

const EMPTY_FORM: TempForm = {
  name: "",
  scope: "all",
  minCelsius: "",
  maxCelsius: "",
  cooldownMinutes: "5",
  enabled: true,
};

/** Dialog for creating/editing temperature thresholds. */
export function TemperatureThresholdForm({
  open,
  onOpenChange,
  threshold,
  groups,
  onSuccess,
}: TempThresholdFormProps) {
  const isEdit = Boolean(threshold);
  const [form, setForm] = useState<TempForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (threshold) {
      let scope = "all";
      if (threshold.groupId) {
        scope = "group-" + threshold.groupId;
      } else if (threshold.cameraId) {
        scope = "camera-" + threshold.cameraId;
      }
      setForm({
        name: threshold.name,
        scope,
        minCelsius: threshold.minCelsius?.toString() ?? "",
        maxCelsius: threshold.maxCelsius?.toString() ?? "",
        cooldownMinutes: threshold.cooldownMinutes.toString(),
        enabled: threshold.enabled,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [threshold, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const minCelsius = form.minCelsius ? parseFloat(form.minCelsius) : null;
    const maxCelsius = form.maxCelsius ? parseFloat(form.maxCelsius) : null;

    if (minCelsius === null && maxCelsius === null) {
      setError("At least min or max temperature is required");
      setSubmitting(false);
      return;
    }

    try {
      const url = isEdit
        ? `/api/thresholds/temperature/${threshold!.id}`
        : "/api/thresholds/temperature";
      const method = isEdit ? "PUT" : "POST";
      const isGroup = form.scope.startsWith("group-");
      const body = {
        name: form.name,
        cameraId: null as string | null,
        groupId: null as string | null,
        minCelsius,
        maxCelsius,
        cooldownMinutes: parseInt(form.cooldownMinutes, 10),
        enabled: form.enabled,
      };
      if (isGroup) {
        body.groupId = form.scope.replace(/^group-/, "");
      } else if (form.scope !== "all") {
        body.cameraId = form.scope.replace(/^camera-/, "");
      }

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
          <DialogTitle>{isEdit ? "Edit" : "Add"} Temperature Threshold</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="temp-name">Name</Label>
            <Input
              id="temp-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="High temperature alert"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="temp-scope">Scope</Label>
            <Select
              value={form.scope}
              onValueChange={(v) => setForm((f) => ({ ...f, scope: v }))}
            >
              <SelectTrigger id="temp-scope">
                <SelectValue placeholder="Global (All)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Global (All)</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={`group-${g.id}`}>
                    {g.name} ({g.cameraCount} cameras)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="temp-min">Min Temp (°C)</Label>
              <Input
                id="temp-min"
                type="number"
                step="0.1"
                value={form.minCelsius}
                onChange={(e) => setForm((f) => ({ ...f, minCelsius: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="temp-max">Max Temp (°C)</Label>
              <Input
                id="temp-max"
                type="number"
                step="0.1"
                value={form.maxCelsius}
                onChange={(e) => setForm((f) => ({ ...f, maxCelsius: e.target.value }))}
                placeholder="100"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="temp-cooldown">Cooldown (minutes)</Label>
            <Input
              id="temp-cooldown"
              type="number"
              min="1"
              value={form.cooldownMinutes}
              onChange={(e) => setForm((f) => ({ ...f, cooldownMinutes: e.target.value }))}
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="temp-enabled"
              checked={form.enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
            />
            <Label htmlFor="temp-enabled">Enabled</Label>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
