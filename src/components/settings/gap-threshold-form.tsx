"use client";

import { useState, useEffect } from "react";
import { GapThreshold, GapDirection } from "@/types/threshold";
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

interface GapThresholdFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threshold?: GapThreshold | null;
  groups: { id: string; name: string; cameraCount: number }[];
  onSuccess: () => void;
}

interface GapForm {
  name: string;
  scope: string; // "all" for global, "group-{id}" for group
  intervalMinutes: string;
  maxGapCelsius: string;
  direction: GapDirection;
  cooldownMinutes: string;
  enabled: boolean;
}

const EMPTY_FORM: GapForm = {
  name: "",
  scope: "all",
  intervalMinutes: "10",
  maxGapCelsius: "10",
  direction: "BOTH",
  cooldownMinutes: "5",
  enabled: true,
};

/** Dialog for creating/editing gap thresholds. */
export function GapThresholdForm({
  open,
  onOpenChange,
  threshold,
  groups,
  onSuccess,
}: GapThresholdFormProps) {
  const isEdit = Boolean(threshold);
  const [form, setForm] = useState<GapForm>(EMPTY_FORM);
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
        intervalMinutes: threshold.intervalMinutes.toString(),
        maxGapCelsius: threshold.maxGapCelsius.toString(),
        direction: threshold.direction,
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

    try {
      const url = isEdit
        ? `/api/thresholds/gap/${threshold!.id}`
        : "/api/thresholds/gap";
      const method = isEdit ? "PUT" : "POST";
      const isGroup = form.scope.startsWith("group-");
      const body = {
        name: form.name,
        cameraId: null as string | null,
        groupId: null as string | null,
        intervalMinutes: parseInt(form.intervalMinutes, 10),
        maxGapCelsius: parseFloat(form.maxGapCelsius),
        direction: form.direction,
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
          <DialogTitle>{isEdit ? "Edit" : "Add"} Gap Threshold</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gap-name">Name</Label>
            <Input
              id="gap-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Rapid temperature change"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gap-scope">Scope</Label>
            <Select
              value={form.scope}
              onValueChange={(v) => setForm((f) => ({ ...f, scope: v }))}
            >
              <SelectTrigger id="gap-scope">
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
              <Label htmlFor="gap-interval">Interval (minutes)</Label>
              <Input
                id="gap-interval"
                type="number"
                min="1"
                value={form.intervalMinutes}
                onChange={(e) => setForm((f) => ({ ...f, intervalMinutes: e.target.value }))}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gap-max">Max Gap (°C)</Label>
              <Input
                id="gap-max"
                type="number"
                step="0.1"
                min="0"
                value={form.maxGapCelsius}
                onChange={(e) => setForm((f) => ({ ...f, maxGapCelsius: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gap-direction">Direction</Label>
            <Select
              value={form.direction}
              onValueChange={(v) => setForm((f) => ({ ...f, direction: v as GapDirection }))}
            >
              <SelectTrigger id="gap-direction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RISE">Rise Only</SelectItem>
                <SelectItem value="DROP">Drop Only</SelectItem>
                <SelectItem value="BOTH">Rise or Drop</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gap-cooldown">Cooldown (minutes)</Label>
            <Input
              id="gap-cooldown"
              type="number"
              min="1"
              value={form.cooldownMinutes}
              onChange={(e) => setForm((f) => ({ ...f, cooldownMinutes: e.target.value }))}
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="gap-enabled"
              checked={form.enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
            />
            <Label htmlFor="gap-enabled">Enabled</Label>
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
