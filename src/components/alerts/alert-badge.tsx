"use client";

import { Badge } from "@/components/ui/badge";

interface AlertBadgeProps {
  count: number;
}

/** Displays unacknowledged alert count with pulse animation when non-zero. */
export function AlertBadge({ count }: AlertBadgeProps) {
  if (count === 0) return null;

  return (
    <span className="relative inline-flex">
      <Badge
        variant="destructive"
        className="animate-pulse tabular-nums"
      >
        {count > 99 ? "99+" : count}
      </Badge>
    </span>
  );
}
