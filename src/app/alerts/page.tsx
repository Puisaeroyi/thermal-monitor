"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { AlertFilters, type AlertFiltersState } from "@/components/alerts/alert-filters";
import { AlertList } from "@/components/alerts/alert-list";

interface Camera {
  id: string;
  name: string;
}

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

  // Load cameras once for filter dropdown
  useEffect(() => {
    fetch("/api/cameras")
      .then((r) => r.json())
      .then((d) => setCameras(Array.isArray(d) ? d : d.cameras ?? []))
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
      params.set("page", String(page));

      const res = await fetch(`/api/alerts?${params.toString()}`);
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

  async function handleAcknowledge(id: string) {
    try {
      const res = await fetch(`/api/alerts/${id}/acknowledge`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to acknowledge alert");
      toast.success("Alert acknowledged");
      fetchAlerts();
    } catch {
      toast.error("Failed to acknowledge alert");
    }
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
          onAcknowledge={handleAcknowledge}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
