"use client";

import { useTempUnit } from "@/contexts/temp-unit-context";
import { formatTemperature } from "@/lib/temperature-utils";

/** Custom Recharts tooltip showing formatted timestamp and temperature. */

interface TooltipEntry {
  dataKey?: string | number;
  name?: string;
  value?: number | string;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  /** When set, values are already converted — display directly with this unit suffix */
  unitOverride?: "C" | "F";
}

export function CustomTooltip({ active, payload, label, unitOverride }: CustomTooltipProps) {
  const { unit: contextUnit } = useTempUnit();
  const unit = unitOverride ?? contextUnit;
  if (!active || !payload || payload.length === 0) return null;

  const ts = label ? new Date(String(label)) : null;
  const formatted = ts && !isNaN(ts.getTime())
    ? ts.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : String(label);

  /** Format value — if unitOverride is set, value is already converted; otherwise convert from Celsius */
  const formatValue = (value: number): string => {
    if (unitOverride) {
      return `${Math.round(value * 10) / 10}°${unit}`;
    }
    return formatTemperature(value, unit);
  };

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
      <p className="text-muted-foreground mb-1">{formatted}</p>
      {payload.map((entry, i) => (
        <p key={`${entry.dataKey ?? i}`} className="font-medium" style={{ color: entry.color }}>
          {entry.name ?? "Temperature"}: {typeof entry.value === "number" ? formatValue(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}
