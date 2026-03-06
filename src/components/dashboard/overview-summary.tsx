"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Wifi, WifiOff } from "lucide-react";

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

      <div className="text-3xl opacity-80">{icon}</div>
    </div>
  );
}

export function CameraOverview() {
  const router = useRouter();
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/cameras");
        if (!res.ok) return;
        const cameras: { status: string }[] = await res.json();
        const active = cameras.filter((c) => c.status === "ACTIVE").length;
        setStats({
          total: cameras.length,
          active,
          inactive: cameras.length - active,
        });
      } catch {}
    }
    fetchStats();
    const id = setInterval(fetchStats, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card className="cursor-pointer hover:shadow-md transition" onClick={() => router.push("/cameras")}>
      <CardHeader>
        <CardTitle className="text-lg">Camera Overview</CardTitle>
      </CardHeader>

      <CardContent className="flex gap-6">
        <StatItem
          label="Total Cameras"
          value={stats.total}
          icon={<Camera className="text-blue-500" />}
          color="bg-blue-500/10 border-blue-500/30"
        />

        <StatItem
          label="Connected"
          value={stats.active}
          icon={<Wifi className="text-green-500" />}
          color="bg-green-500/10 border-green-500/30"
        />

        <StatItem
          label="Disconnected"
          value={stats.inactive}
          icon={<WifiOff className="text-red-500" />}
          color="bg-red-500/10 border-red-500/30"
        />
      </CardContent>
    </Card>
  );
}
