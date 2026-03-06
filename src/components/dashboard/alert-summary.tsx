"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, CheckCircle, AlertTriangle } from "lucide-react";

interface StatItemProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function StatItem({ label, value, icon, color }: StatItemProps) {
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
  const router = useRouter();
  const [stats, setStats] = useState({ total: 0, checked: 0, unchecked: 0 });

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/alerts?stats=true");
        if (!res.ok) return;
        const data = await res.json();
        setStats({
          total: data.total ?? 0,
          checked: data.acknowledged ?? 0,
          unchecked: data.unacknowledged ?? 0,
        });
      } catch {}
    }
    fetchStats();
    const id = setInterval(fetchStats, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="cursor-pointer hover:shadow-md transition" onClick={() => router.push("/alerts")}>
      <CardHeader>
        <CardTitle className="text-lg">Alert Events</CardTitle>
      </CardHeader>

      <CardContent className="flex gap-6">
        <StatItem
          label="Total Events"
          value={stats.total}
          icon={<Bell className="text-yellow-500" />}
          color="bg-yellow-500/10 border-yellow-500/30"
        />

        <StatItem
          label="Checked"
          value={stats.checked}
          icon={<CheckCircle className="text-green-500" />}
          color="bg-green-500/10 border-green-500/30"
        />

        <StatItem
          label="Unchecked"
          value={stats.unchecked}
          icon={<AlertTriangle className="text-red-500" />}
          color="bg-red-500/10 border-red-500/30"
        />
      </CardContent>
    </Card>
  );
}
