"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSSE } from "@/hooks/use-sse";
import { Reading } from "@/types/reading";
import { POLLING_INTERVAL_MS } from "@/lib/constants";

interface UseReadingsResult {
  readings: Reading[];
  isLoading: boolean;
  error: string | null;
}

/** Fetch and poll readings for a given camera and time window (minutes). */
export function useReadings(cameraId: string, timeRange: number): UseReadingsResult {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastTimestampRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseSource = useSSE();

  const fetchInitial = useCallback(async () => {
    if (!cameraId) return;
    setIsLoading(true);
    setError(null);
    lastTimestampRef.current = null;
    const from = new Date(Date.now() - timeRange * 60 * 1000).toISOString();
    try {
      const res = await fetch(
        `/api/readings?cameraId=${encodeURIComponent(cameraId)}&from=${encodeURIComponent(from)}&limit=360`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Reading[] = await res.json();
      const sorted = [...data].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setReadings(sorted);
      if (sorted.length > 0) {
        lastTimestampRef.current = sorted[sorted.length - 1].timestamp;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch readings");
    } finally {
      setIsLoading(false);
    }
  }, [cameraId, timeRange]);

  const fetchIncremental = useCallback(async () => {
    if (!cameraId) return;
    const from = lastTimestampRef.current
      ? new Date(new Date(lastTimestampRef.current).getTime() + 1).toISOString()
      : new Date(Date.now() - timeRange * 60 * 1000).toISOString();
    try {
      const res = await fetch(
        `/api/readings?cameraId=${encodeURIComponent(cameraId)}&from=${encodeURIComponent(from)}&limit=100`
      );
      if (!res.ok) return;
      const data: Reading[] = await res.json();
      if (data.length === 0) return;
      const sorted = [...data].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      const cutoff = Date.now() - timeRange * 60 * 1000;
      setReadings((prev) => {
        const merged = [...prev, ...sorted].filter(
          (r) => new Date(r.timestamp).getTime() >= cutoff
        );
        // deduplicate by id
        const seen = new Set<string>();
        return merged.filter((r) => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        });
      });
      lastTimestampRef.current = sorted[sorted.length - 1].timestamp;
    } catch {
      // silent poll failure
    }
  }, [cameraId, timeRange]);

  // SSE listener for real-time incremental updates
  useEffect(() => {
    if (!sseSource || !cameraId) return;

    const handler = (e: MessageEvent) => {
      try {
        const allReadings: Reading[] = JSON.parse(e.data);
        // Filter readings for this specific camera
        const cameraReadings = allReadings.filter((r) => r.cameraId === cameraId);
        if (cameraReadings.length === 0) return;

        const cutoff = Date.now() - timeRange * 60 * 1000;
        setReadings((prev) => {
          const merged = [...prev, ...cameraReadings].filter(
            (r) => new Date(r.timestamp).getTime() >= cutoff
          );
          // deduplicate by id
          const seen = new Set<string>();
          return merged.filter((r) => {
            if (seen.has(r.id)) return false;
            seen.add(r.id);
            return true;
          });
        });
      } catch (err) {
        console.error("[use-readings] SSE parse error:", err);
      }
    };

    sseSource.addEventListener("readings", handler);
    return () => sseSource.removeEventListener("readings", handler);
  }, [sseSource, cameraId, timeRange]);

  // Reset on cameraId or timeRange change
  useEffect(() => {
    setReadings([]);
    fetchInitial();
  }, [fetchInitial]);

  // Start polling after initial load (fallback if SSE unavailable)
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!sseSource) {
      // Only poll if SSE is not available
      intervalRef.current = setInterval(fetchIncremental, POLLING_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchIncremental, sseSource]);

  return { readings, isLoading, error };
}
