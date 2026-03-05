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
import { useTempUnit } from "@/contexts/temp-unit-context";
import { formatTemperature } from "@/lib/temperature-utils";

interface AlertRow {
  id: string;
  eventId: number;
  cameraId: string;
  displayType: "Max Temperature" | "Increase Temperature";
  statusLabel: "Checked" | "Unchecked";
  type: string;
  message: string;
  shortMessage: string;
  celsius: number;
  thresholdValue: number | null;
  note: string | null;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
  camera?: { name: string; ip?: string | null };
}

interface AlertListProps {
  alerts: AlertRow[];
  total: number;
  page: number;
  pages: number;
  onCheck: (alert: AlertRow) => void;
  onEditNote: (alert: AlertRow) => void;
  onViewNote: (alert: AlertRow) => void;
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
  onCheck,
  onEditNote,
  onViewNote,
  onPageChange,
}: AlertListProps) {
  const { unit } = useTempUnit();

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Event ID</TableHead>
            <TableHead className="w-[170px]">Timestamp</TableHead>
            <TableHead>Camera</TableHead>
            <TableHead className="w-[130px]">IP</TableHead>
            <TableHead className="w-[110px]">Type</TableHead>
            <TableHead>Message</TableHead>
            <TableHead className="w-[95px] text-right">Temp ({unit})</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[120px]">Action</TableHead>
            <TableHead className="w-[90px]">Note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                No alerts found.
              </TableCell>
            </TableRow>
          )}
          {alerts.map((alert) => (
            <TableRow key={alert.id} className={severityColor(alert.type, alert.acknowledged)}>
              <TableCell className="tabular-nums">{alert.eventId}</TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(alert.createdAt).toLocaleString()}
              </TableCell>
              <TableCell className="font-medium">
                {alert.camera?.name ?? alert.cameraId}
              </TableCell>
              <TableCell className="text-sm">{alert.camera?.ip ?? ""}</TableCell>
              <TableCell>
                <Badge variant={alert.type === "GAP" ? "outline" : "destructive"}>
                  {alert.displayType}
                </Badge>
              </TableCell>
              <TableCell className="text-sm max-w-[240px] whitespace-normal leading-snug" title={alert.message}>
                {alert.shortMessage}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatTemperature(alert.celsius, unit)}
              </TableCell>
              <TableCell>
                <Badge variant={alert.acknowledged ? "secondary" : "destructive"}>
                  {alert.statusLabel}
                </Badge>
              </TableCell>
              <TableCell>
                {!alert.acknowledged && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onCheck(alert)}
                  >
                    Checked
                  </Button>
                )}
                {alert.acknowledged && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEditNote(alert)}
                  >
                    Edit
                  </Button>
                )}
              </TableCell>
              <TableCell>
                {alert.note ? (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-sm"
                    onClick={() => onViewNote(alert)}
                  >
                    View
                  </Button>
                ) : (
                  "-"
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
