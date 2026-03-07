import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, CheckCircle, XCircle, Bell, BellOff, Activity } from "lucide-react";
import type { CameraReading } from "@/hooks/use-cameras";

interface AlertStats {
  total: number;
  acknowledged: number;
  unacknowledged: number;
}

interface StatusSummaryProps {
  cameras: CameraReading[];
  alertStats?: AlertStats;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  description?: string;
}

function StatCard({ label, value, icon, description }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
          <span className="text-muted-foreground">{icon}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Two-row summary: cameras row + events row */
export function StatusSummary({ cameras, alertStats }: StatusSummaryProps) {
  const total = cameras.length;
  const connected = cameras.filter((c) => c.status === "ACTIVE").length;
  const disconnected = total - connected;

  return (
    <div className="flex flex-col gap-6">
      {/* Section 1: Camera Overview */}
      <Link href="/cameras" className="flex flex-col gap-2 group">
        <div className="flex items-center gap-2">
          <Camera className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide group-hover:text-foreground transition-colors">Camera Overview</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Total Cameras"
            value={total}
            icon={<Camera className="size-4" />}
            description="registered devices"
          />
          <StatCard
            label="Connected"
            value={connected}
            icon={<CheckCircle className="size-4 text-green-500" />}
            description="reporting normally"
          />
          <StatCard
            label="Disconnected"
            value={disconnected}
            icon={<XCircle className="size-4 text-gray-400" />}
            description="offline or disabled"
          />
        </div>
      </Link>

      {/* Section 2: Alert Events */}
      <Link href="/alerts" className="flex flex-col gap-2 group">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide group-hover:text-foreground transition-colors">Alert Events</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Total Events"
            value={alertStats?.total ?? 0}
            icon={<Activity className="size-4 text-blue-500" />}
            description="all alert events"
          />
          <StatCard
            label="Acknowledged"
            value={alertStats?.acknowledged ?? 0}
            icon={<BellOff className="size-4 text-green-500" />}
            description="reviewed and cleared"
          />
          <StatCard
            label="Unacknowledged"
            value={alertStats?.unacknowledged ?? 0}
            icon={<Bell className="size-4 text-red-500" />}
            description="requires attention"
          />
        </div>
      </Link>
    </div>
  );
}
