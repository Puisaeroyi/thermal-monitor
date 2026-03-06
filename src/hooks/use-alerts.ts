"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSSE } from "@/hooks/use-sse";
import { usePolling } from "@/hooks/use-polling";
import { ALERT_POLLING_INTERVAL_MS } from "@/lib/constants";

interface AlertItem {
  id: string;
  cameraId: string;
  type: string;
  message: string;
  celsius: number;
  acknowledged: boolean;
  createdAt: string;
  camera?: { name: string };
}

interface UseAlertsResult {
  unacknowledgedCount: number;
  alerts: AlertItem[];
}

/** Polls unacknowledged alerts with SSE primary for new alert toasts. */
export function useAlerts(): UseAlertsResult {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const lastCheckedAt = useRef<string | null>(null);
  const sseSource = useSSE();

  // SSE listener for new alerts - primary real-time updates
  useEffect(() => {
    if (!sseSource) return;

    const handler = (e: MessageEvent) => {
      try {
        const alert: AlertItem = JSON.parse(e.data);
        // Prepend new alert to list
        setAlerts((prev) => {
          // Avoid duplicates
          if (prev.some((a) => a.id === alert.id)) return prev;
          return [alert, ...prev];
        });
        // Show toast for new alert
        const cameraLabel = alert.camera?.name ?? alert.cameraId;
        toast.warning(`Alert: ${alert.type} — ${cameraLabel}`, {
          description: alert.message,
        });
      } catch (err) {
        console.error("[use-alerts] SSE parse error:", err);
      }
    };

    sseSource.addEventListener("alert", handler);
    return () => sseSource.removeEventListener("alert", handler);
  }, [sseSource]);

  // Fallback polling for alert list and count
  const { data: polledData } = usePolling<{ alerts: AlertItem[]; total: number }>(
    "/api/alerts?acknowledged=false&limit=5",
    ALERT_POLLING_INTERVAL_MS,
    { enabled: !sseSource }
  );

  useEffect(() => {
    if (polledData && !sseSource) {
      const fetched = polledData.alerts ?? [];

      // Detect new alerts since last check (for polling fallback)
      if (lastCheckedAt.current !== null) {
        const newAlerts = fetched.filter(
          (a) => a.createdAt > lastCheckedAt.current!
        );
        for (const a of newAlerts) {
          const cameraLabel = a.camera?.name ?? a.cameraId;
          toast.warning(`Alert: ${a.type} — ${cameraLabel}`, {
            description: a.message,
          });
        }
      }

      if (fetched.length > 0) {
        lastCheckedAt.current = fetched[0].createdAt;
      }

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAlerts(fetched);
      setUnacknowledgedCount(polledData.total ?? fetched.length);
    }
  }, [polledData, sseSource]);

  // Initial fetch for SSE mode (get full list on mount)
  useEffect(() => {
    if (sseSource) {
      async function fetchInitialAlerts() {
        try {
          const res = await fetch("/api/alerts?acknowledged=false&limit=5");
          if (!res.ok) return;
          const data = await res.json();
          const fetched: AlertItem[] = data.alerts ?? [];
          setAlerts(fetched);
          setUnacknowledgedCount(data.total ?? fetched.length);
          if (fetched.length > 0) {
            lastCheckedAt.current = fetched[0].createdAt;
          }
        } catch (err) {
          console.error("[use-alerts] Initial fetch error:", err);
        }
      }
      fetchInitialAlerts();
    }
  }, [sseSource]);

  return { unacknowledgedCount, alerts };
}
