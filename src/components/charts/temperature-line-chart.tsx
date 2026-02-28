"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { CustomTooltip } from "./custom-tooltip";

interface Reading {
  timestamp: string;
  celsius: number;
  maxCelsius?: number | null;
  minCelsius?: number | null;
}

interface ThresholdLine {
  maxCelsius?: number;
  minCelsius?: number;
  name: string;
}

interface TemperatureLineChartProps {
  readings: Reading[];
  thresholds?: ThresholdLine[];
}

function formatXAxis(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Line chart for temperature readings with optional threshold reference lines and min/max range band. */
export function TemperatureLineChart({ readings, thresholds = [] }: TemperatureLineChartProps) {
  if (readings.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground text-sm">
        No readings available for this time range.
      </div>
    );
  }

  const hasRange = readings.some((r) => r.maxCelsius != null && r.minCelsius != null);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={readings} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
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
          tickFormatter={(v: number) => `${v.toFixed(0)}°`}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        {hasRange && (
          <Area
            type="monotone"
            dataKey="maxCelsius"
            name="Max"
            stroke="none"
            fill="#2563eb"
            fillOpacity={0.08}
            isAnimationActive={false}
          />
        )}
        {hasRange && (
          <Area
            type="monotone"
            dataKey="minCelsius"
            name="Min"
            stroke="none"
            fill="var(--background, #ffffff)"
            fillOpacity={1}
            isAnimationActive={false}
          />
        )}
        <Line
          type="monotone"
          dataKey="celsius"
          name="Temperature"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        {thresholds.flatMap((t) => {
          const lines = [];
          if (t.maxCelsius != null) {
            lines.push(
              <ReferenceLine
                key={`max-${t.name}`}
                y={t.maxCelsius}
                stroke="#dc2626"
                strokeDasharray="4 4"
                label={{ value: `${t.name} max`, fill: "#dc2626", fontSize: 11, position: "insideTopRight" }}
              />
            );
          }
          if (t.minCelsius != null) {
            lines.push(
              <ReferenceLine
                key={`min-${t.name}`}
                y={t.minCelsius}
                stroke="#2563eb"
                strokeDasharray="4 4"
                label={{ value: `${t.name} min`, fill: "#2563eb", fontSize: 11, position: "insideBottomRight" }}
              />
            );
          }
          return lines;
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
