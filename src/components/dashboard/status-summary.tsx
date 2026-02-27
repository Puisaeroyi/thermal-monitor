import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, CheckCircle, XCircle, Bell } from "lucide-react";
import type { CameraReading } from "@/hooks/use-cameras";

interface StatusSummaryProps {
  cameras: CameraReading[];
  alertCount?: number;
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

/** 4-card summary row: Total, Active, Inactive, Alerts */
export function StatusSummary({ cameras, alertCount = 0 }: StatusSummaryProps) {
  const total = cameras.length;
  const active = cameras.filter((c) => c.status === "ACTIVE").length;
  const inactive = total - active;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Cameras"
        value={total}
        icon={<Camera className="size-4" />}
        description="registered devices"
      />
      <StatCard
        label="Active"
        value={active}
        icon={<CheckCircle className="size-4 text-green-500" />}
        description="reporting normally"
      />
      <StatCard
        label="Inactive"
        value={inactive}
        icon={<XCircle className="size-4 text-gray-400" />}
        description="offline or disabled"
      />
      <StatCard
        label="Alerts Active"
        value={alertCount}
        icon={<Bell className="size-4 text-red-500" />}
        description="unacknowledged"
      />
    </div>
  );
}
