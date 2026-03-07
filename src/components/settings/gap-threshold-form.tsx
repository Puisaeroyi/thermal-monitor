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
import { celsiusToFahrenheit, fahrenheitToCelsius } from "@/lib/temperature-utils";

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
  unit: "C" | "F"; // User-selected unit for input
  intervalMinutes: string;
  maxGap: string; // Display value in selected unit
  direction: GapDirection;
  enabled: boolean;
}

const EMPTY_FORM: GapForm = {
  name: "",
  scope: "all",
  unit: "F", // Default to Fahrenheit
  intervalMinutes: "10",
  maxGap: "18", // Default 18°F (≈10°C)
  direction: "BOTH",
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
      // Default to Fahrenheit for editing, convert from Celsius
      const unit: "C" | "F" = "F";
      const maxGap = unit === "F"
        ? celsiusToFahrenheit(threshold.maxGapCelsius).toString()
        : threshold.maxGapCelsius.toString();
      setForm({
        name: threshold.name,
        scope,
        unit,
        intervalMinutes: threshold.intervalMinutes.toString(),
        maxGap,
        direction: threshold.direction,
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

    // Convert from display unit to Celsius for database storage
    // Note: For gap/threshold, we convert the delta (1°C delta = 1.8°F delta)
    const maxGapCelsius = form.unit === "F"
      ? parseFloat(form.maxGap) / 1.8
      : parseFloat(form.maxGap);

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
        maxGapCelsius,
        direction: form.direction,
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gap-unit">Temperature Unit</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={form.unit === "C" ? "default" : "outline"}
                onClick={() => setForm((f) => ({ ...f, unit: "C" }))}
                className="w-20"
              >
                °C
              </Button>
              <Button
                type="button"
                variant={form.unit === "F" ? "default" : "outline"}
                onClick={() => setForm((f) => ({ ...f, unit: "F" }))}
                className="w-20"
              >
                °F
              </Button>
            </div>
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
              <Label htmlFor="gap-max">Max Gap ({form.unit === "F" ? "°F" : "°C"})</Label>
              <Input
                id="gap-max"
                type="number"
                step="0.1"
                min="0"
                value={form.maxGap}
                onChange={(e) => setForm((f) => ({ ...f, maxGap: e.target.value }))}
                placeholder={form.unit === "F" ? "18" : "10"}
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
