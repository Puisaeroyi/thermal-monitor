"use client";

import { cn } from "@/lib/utils";

const TIME_RANGES = [
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "6h", value: 360 },
  { label: "24h", value: 1440 },
];

interface TimeRangeSelectorProps {
  value: number;
  onChange: (minutes: number) => void;
}

/** Button group for selecting chart time window. */
export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border p-1 w-fit">
      {TIME_RANGES.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium transition-colors",
            value === range.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
