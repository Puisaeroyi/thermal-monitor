"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AlertRow {
  id: string;
  cameraId: string;
  type: string;
  message: string;
  celsius: number;
  thresholdValue: number | null;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
  camera?: { name: string };
}

interface AlertListProps {
  alerts: AlertRow[];
  total: number;
  page: number;
  pages: number;
  onAcknowledge: (id: string) => void;
  onPageChange: (page: number) => void;
}

function severityColor(type: string, acknowledged: boolean): string {
  if (acknowledged) return "border-l-4 border-l-muted";
  if (type === "GAP") return "border-l-4 border-l-orange-500";
  return "border-l-4 border-l-red-500";
}

/** Paginated alert history table with per-row acknowledge action. */
export function AlertList({
  alerts,
  total,
  page,
  pages,
  onAcknowledge,
  onPageChange,
}: AlertListProps) {
  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[170px]">Timestamp</TableHead>
            <TableHead>Camera</TableHead>
            <TableHead className="w-[110px]">Type</TableHead>
            <TableHead>Message</TableHead>
            <TableHead className="w-[90px] text-right">Temp (°C)</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No alerts found.
              </TableCell>
            </TableRow>
          )}
          {alerts.map((alert) => (
            <TableRow key={alert.id} className={severityColor(alert.type, alert.acknowledged)}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(alert.createdAt).toLocaleString()}
              </TableCell>
              <TableCell className="font-medium">
                {alert.camera?.name ?? alert.cameraId}
              </TableCell>
              <TableCell>
                <Badge variant={alert.type === "GAP" ? "outline" : "destructive"}>
                  {alert.type}
                </Badge>
              </TableCell>
              <TableCell className="text-sm max-w-xs truncate" title={alert.message}>
                {alert.message}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {alert.celsius.toFixed(2)}
              </TableCell>
              <TableCell>
                {alert.acknowledged ? (
                  <Badge variant="secondary">Acknowledged</Badge>
                ) : (
                  <Badge variant="destructive">Unacknowledged</Badge>
                )}
              </TableCell>
              <TableCell>
                {!alert.acknowledged && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAcknowledge(alert.id)}
                  >
                    Acknowledge
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} alert{total !== 1 ? "s" : ""} total
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="px-2 py-1">
            Page {page} of {pages || 1}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
