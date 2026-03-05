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
  sort: "asc" | "desc";
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
            <SelectItem value="MAX_TEMPERATURE">Max Temperature</SelectItem>
            <SelectItem value="INCREASE_TEMPERATURE">Increase Temperature</SelectItem>
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
            <SelectItem value="false">Unchecked</SelectItem>
            <SelectItem value="true">Checked</SelectItem>
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

      {/* Sort by timestamp */}
      <div className="flex flex-col gap-1 min-w-[190px]">
        <Label>Sort Timestamp</Label>
        <Select value={filters.sort} onValueChange={(v) => update("sort", v as "asc" | "desc")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest to oldest</SelectItem>
            <SelectItem value="asc">Oldest to newest</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
