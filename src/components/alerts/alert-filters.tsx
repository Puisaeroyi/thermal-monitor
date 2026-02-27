"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AlertFiltersState {
  cameraId: string;
  type: string;
  acknowledged: string;
  from: string;
  to: string;
}

interface Camera {
  id: string;
  name: string;
}

interface AlertFiltersProps {
  filters: AlertFiltersState;
  onChange: (filters: AlertFiltersState) => void;
  cameras: Camera[];
}

/** Filter controls for the alerts list: camera, type, status, date range. */
export function AlertFilters({ filters, onChange, cameras }: AlertFiltersProps) {
  function update(key: keyof AlertFiltersState, value: string) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-wrap gap-4 items-end">
      {/* Camera */}
      <div className="flex flex-col gap-1 min-w-[160px]">
        <Label>Camera</Label>
        <Select value={filters.cameraId} onValueChange={(v) => update("cameraId", v)}>
          <SelectTrigger>
            <SelectValue placeholder="All cameras" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cameras</SelectItem>
            {cameras.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Type */}
      <div className="flex flex-col gap-1 min-w-[160px]">
        <Label>Type</Label>
        <Select value={filters.type} onValueChange={(v) => update("type", v)}>
          <SelectTrigger>
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="TEMPERATURE">Temperature</SelectItem>
            <SelectItem value="GAP">Gap</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1 min-w-[160px]">
        <Label>Status</Label>
        <Select value={filters.acknowledged} onValueChange={(v) => update("acknowledged", v)}>
          <SelectTrigger>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="false">Unacknowledged</SelectItem>
            <SelectItem value="true">Acknowledged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* From */}
      <div className="flex flex-col gap-1 min-w-[180px]">
        <Label>From</Label>
        <Input
          type="datetime-local"
          value={filters.from}
          onChange={(e) => update("from", e.target.value)}
        />
      </div>

      {/* To */}
      <div className="flex flex-col gap-1 min-w-[180px]">
        <Label>To</Label>
        <Input
          type="datetime-local"
          value={filters.to}
          onChange={(e) => update("to", e.target.value)}
        />
      </div>
    </div>
  );
}
