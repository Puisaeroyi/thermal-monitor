"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, CheckCircle, AlertTriangle } from "lucide-react";

interface StatItemProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function StatItem({ label, value, icon, color }: StatItemProps & { color: string }) {
  return (
    <div
      className={`flex-1 flex items-center justify-between 
      px-6 py-6 rounded-xl border ${color}`}
    >
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-5xl font-bold">{value}</p>
      </div>

      <div className="text-3xl opacity-80">
        {icon}
      </div>
    </div>
  );
}

export function AlertOverview() {
  const total = 52;
  const acknowledged = 30;
  const unacknowledged = 22;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Alert Events</CardTitle>
      </CardHeader>

      <CardContent className="flex gap-6">
  <StatItem
    label="Total Events"
    value={total}
    icon={<Bell className="text-yellow-500" />}
    color="bg-yellow-500/10 border-yellow-500/30"
  />

  <StatItem
    label="Acknowledged"
    value={acknowledged}
    icon={<CheckCircle className="text-green-500" />}
    color="bg-green-500/10 border-green-500/30"
  />

  <StatItem
    label="Unacknowledged"
    value={unacknowledged}
    icon={<AlertTriangle className="text-red-500" />}
    color="bg-red-500/10 border-red-500/30"
  />
</CardContent>
    </Card>
  );
}