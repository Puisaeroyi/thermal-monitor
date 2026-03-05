"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { AlertFilters, type AlertFiltersState } from "@/components/alerts/alert-filters";
import { AlertList } from "@/components/alerts/alert-list";
import {
  AlertNoteDialog,
  type AlertNoteDialogMode,
} from "@/components/alerts/alert-note-dialog";

interface Camera {
  id: string;
  name: string;
}

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

interface AlertsResponse {
  alerts: AlertRow[];
  total: number;
  page: number;
  pages: number;
}

const DEFAULT_FILTERS: AlertFiltersState = {
  cameraId: "all",
  type: "all",
  acknowledged: "all",
  from: "",
  to: "",
  sort: "desc",
};

/** Alert history page — filterable, paginated list with acknowledge actions. */
export default function AlertsPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [filters, setFilters] = useState<AlertFiltersState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AlertsResponse>({
    alerts: [],
    total: 0,
    page: 1,
    pages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [noteDialog, setNoteDialog] = useState<{
    open: boolean;
    mode: AlertNoteDialogMode;
    alert: AlertRow | null;
  }>({
    open: false,
    mode: "view",
    alert: null,
  });

  // Load cameras once for filter dropdown
  useEffect(() => {
    fetch("/api/cameras")
      .then((r) => r.json())
      .then((d) => {
        const rows = (Array.isArray(d) ? d : d.cameras ?? []) as Array<{
          id?: string;
          cameraId?: string;
          name?: string;
        }>;
        setCameras(
          rows
            .map((c) => ({
              id: c.cameraId ?? c.id ?? "",
              name: c.name ?? "",
            }))
            .filter((c) => c.id && c.name)
        );
      })
      .catch(() => {});
  }, []);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.cameraId && filters.cameraId !== "all") params.set("cameraId", filters.cameraId);
      if (filters.type && filters.type !== "all") params.set("type", filters.type);
      if (filters.acknowledged !== "all") params.set("acknowledged", filters.acknowledged);
      if (filters.from) params.set("from", new Date(filters.from).toISOString());
      if (filters.to) params.set("to", new Date(filters.to).toISOString());
      params.set("sort", filters.sort);
      params.set("page", String(page));

      const res = await fetch(`/api/alerts?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch alerts");
      setData(await res.json());
    } catch (err) {
      console.error(err);
      toast.error("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Reset to page 1 whenever filters change
  function handleFiltersChange(next: AlertFiltersState) {
    setFilters(next);
    setPage(1);
  }

  function openNoteDialog(mode: AlertNoteDialogMode, alert: AlertRow) {
    setNoteDialog({ open: true, mode, alert });
  }

  function handleNoteDialogOpenChange(open: boolean) {
    if (open) return;
    setNoteDialog({ open: false, mode: "view", alert: null });
  }

  async function handleSubmitNote(alertId: string, note: string) {
    const res = await fetch(`/api/alerts/${alertId}/acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });

    let payload: { error?: string } | null = null;
    try {
      payload = await res.json();
    } catch {
      // Ignore non-JSON responses.
    }

    if (!res.ok) {
      throw new Error(payload?.error ?? "Failed to save note");
    }

    const wasChecked = noteDialog.alert?.acknowledged ?? false;

    // Reflect latest status/note immediately in current table before re-fetch.
    setData((prev) => ({
      ...prev,
      alerts: prev.alerts.map((alert) =>
        alert.id === alertId
          ? {
              ...alert,
              acknowledged: true,
              statusLabel: "Checked",
              note,
            }
          : alert
      ),
    }));

    toast.success(wasChecked ? "Note updated" : "Alert checked");
    await fetchAlerts();
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Alert History</h1>

      <AlertFilters filters={filters} onChange={handleFiltersChange} cameras={cameras} />

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading alerts...</p>
      ) : (
        <AlertList
          alerts={data.alerts}
          total={data.total}
          page={data.page}
          pages={data.pages}
          onCheck={(alert) => openNoteDialog("check", alert)}
          onEditNote={(alert) => openNoteDialog("edit", alert)}
          onViewNote={(alert) => openNoteDialog("view", alert)}
          onPageChange={setPage}
        />
      )}

      <AlertNoteDialog
        open={noteDialog.open}
        mode={noteDialog.mode}
        alert={noteDialog.alert}
        onOpenChange={handleNoteDialogOpenChange}
        onSubmit={handleSubmitNote}
      />
    </div>
  );
}
