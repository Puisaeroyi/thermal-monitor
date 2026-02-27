"use client";

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
}

export function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
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

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
      <p className="text-muted-foreground mb-1">{formatted}</p>
      {payload.map((entry, i) => (
        <p key={`${entry.dataKey ?? i}`} className="font-medium" style={{ color: entry.color }}>
          {entry.name ?? "Temperature"}: {typeof entry.value === "number" ? entry.value.toFixed(1) : entry.value}°C
        </p>
      ))}
    </div>
  );
}
