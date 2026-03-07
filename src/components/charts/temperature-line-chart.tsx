"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { CustomTooltip } from "./custom-tooltip";
import { useTempUnit } from "@/contexts/temp-unit-context";
import { celsiusToFahrenheit } from "@/lib/temperature-utils";

interface Reading {
  timestamp: string;
  celsius: number;
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
  const { unit } = useTempUnit();
  const toUnit = unit === "F" ? celsiusToFahrenheit : (v: number) => v;

  if (readings.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground text-sm">
        No readings available for this time range.
      </div>
    );
  }

  // Convert readings to selected unit
  const chartData = readings.map((r) => ({
    timestamp: r.timestamp,
    temperature: toUnit(r.celsius),
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
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
        <Line
          type="monotone"
          dataKey="temperature"
          name="Temperature"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        {thresholds.flatMap((t) => {
          const lines = [];
          if (t.maxCelsius != null) {
            lines.push(
              <ReferenceLine
                key={`max-${t.name}`}
                y={toUnit(t.maxCelsius)}
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
                y={toUnit(t.minCelsius)}
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
