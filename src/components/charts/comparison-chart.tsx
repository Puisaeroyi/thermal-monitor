"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { CustomTooltip } from "./custom-tooltip";
import { useTempUnit } from "@/contexts/temp-unit-context";
import { celsiusToFahrenheit } from "@/lib/temperature-utils";
import { useMemo } from "react";

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#9333ea"];

interface CameraDataset {
  cameraId: string;
  name: string;
  readings: { timestamp: string; celsius: number }[];
  color: string;
}

interface ComparisonChartProps {
  datasets: CameraDataset[];
}

/** Merges multiple camera reading series into a shared timestamp-keyed dataset. */
function mergeDatasets(datasets: CameraDataset[], toUnit: (v: number) => number) {
  const map = new Map<string, Record<string, number>>();
  for (const ds of datasets) {
    for (const r of ds.readings) {
      if (!map.has(r.timestamp)) map.set(r.timestamp, {});
      map.get(r.timestamp)![ds.cameraId] = toUnit(r.celsius);
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([timestamp, values]) => ({ timestamp, ...values }));
}

function formatXAxis(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Multi-line chart comparing temperature across multiple cameras. */
export function ComparisonChart({ datasets }: ComparisonChartProps) {
  const { unit } = useTempUnit();
  const toUnit = unit === "F" ? celsiusToFahrenheit : (v: number) => v;
  const merged = useMemo(() => mergeDatasets(datasets, toUnit), [datasets, toUnit]);

  if (datasets.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground text-sm">
        Select cameras to compare.
      </div>
    );
  }

  if (merged.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground text-sm">
        No readings available for selected cameras.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={merged} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={formatXAxis}
          tick={{ fontSize: 12 }}
          minTickGap={40}
        />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fontSize: 12 }}
          tickFormatter={(v: number) => `${v.toFixed(0)}°${unit}`}
          width={48}
        />
        <Tooltip content={<CustomTooltip unitOverride={unit} />} />
        <Legend />
        {datasets.map((ds, i) => (
          <Line
            key={ds.cameraId}
            type="monotone"
            dataKey={ds.cameraId}
            name={ds.name}
            stroke={ds.color || COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
