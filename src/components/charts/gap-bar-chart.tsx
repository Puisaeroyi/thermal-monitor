"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import { useMemo } from "react";

interface Reading {
  timestamp: string;
  celsius: number;
}

interface GapThresholdConfig {
  intervalMinutes: number;
  maxGapCelsius: number;
  name: string;
}

interface GapBarChartProps {
  readings: Reading[];
  gapThresholds?: GapThresholdConfig[];
}

const DEFAULT_WINDOWS = [5, 10, 15];

/** Computes absolute temperature change over a trailing window (minutes). */
function computeGap(readings: Reading[], windowMinutes: number): number | null {
  if (readings.length < 2) return null;
  const latest = readings[readings.length - 1];
  const cutoff = new Date(latest.timestamp).getTime() - windowMinutes * 60 * 1000;
  const baseline = readings.find((r) => new Date(r.timestamp).getTime() >= cutoff);
  if (!baseline) return null;
  return Math.abs(latest.celsius - baseline.celsius);
}

function severityColor(ratio: number): string {
  if (ratio >= 0.8) return "#dc2626"; // red
  if (ratio >= 0.5) return "#ca8a04"; // yellow
  return "#16a34a"; // green
}

/** Bar chart showing rate of temperature change per time window vs configured thresholds. */
export function GapBarChart({ readings, gapThresholds = [] }: GapBarChartProps) {
  const data = useMemo(() => {
    const windows = gapThresholds.length > 0
      ? gapThresholds.map((t) => ({ minutes: t.intervalMinutes, max: t.maxGapCelsius, label: t.name }))
      : DEFAULT_WINDOWS.map((m) => ({ minutes: m, max: null, label: `${m}m` }));

    return windows.map(({ minutes, max, label }) => {
      const gap = computeGap(readings, minutes);
      const ratio = gap != null && max != null ? gap / max : 0;
      return {
        name: label,
        gap: gap != null ? parseFloat(gap.toFixed(2)) : 0,
        max,
        ratio,
      };
    });
  }, [readings, gapThresholds]);

  if (readings.length < 2) {
    return (
      <div className="flex h-[200px] items-center justify-center text-muted-foreground text-sm">
        Not enough readings to compute gaps.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
        <XAxis type="number" domain={[0, "auto"]} tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${v}°`} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={36} />
        <Tooltip
          formatter={(value: number | undefined) => [value != null ? `${value}°C` : "—", "Change"]}
          labelFormatter={(label) => `Window: ${label}`}
        />
        {data.map((entry) =>
          entry.max != null ? (
            <ReferenceLine
              key={`ref-${entry.name}`}
              x={entry.max}
              stroke="#dc2626"
              strokeDasharray="4 4"
            />
          ) : null
        )}
        <Bar dataKey="gap" name="Temp Change" isAnimationActive={false} radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={severityColor(entry.ratio)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
