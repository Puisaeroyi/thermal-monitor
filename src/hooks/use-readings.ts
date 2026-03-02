"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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

  // Reset on cameraId or timeRange change
  useEffect(() => {
    setReadings([]);
    fetchInitial();
  }, [fetchInitial]);

  // Start polling after initial load
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchIncremental, POLLING_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchIncremental]);

  return { readings, isLoading, error };
}
