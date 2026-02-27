"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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

/** Polls unacknowledged alerts every 10s and toasts on new ones. */
export function useAlerts(): UseAlertsResult {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const lastCheckedAt = useRef<string | null>(null);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const res = await fetch("/api/alerts?acknowledged=false&limit=5");
        if (!res.ok) return;

        const data = await res.json();
        const fetched: AlertItem[] = data.alerts ?? [];

        // Detect new alerts since last check
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

        setAlerts(fetched);
        setUnacknowledgedCount(data.total ?? fetched.length);
      } catch (err) {
        console.error("[use-alerts] Fetch error:", err);
      }
    }

    fetchAlerts();
    const interval = setInterval(fetchAlerts, ALERT_POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return { unacknowledgedCount, alerts };
}
