"use client";

import { useState, useEffect, useRef } from "react";

export interface PollingResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

interface PollingOptions {
  enabled?: boolean;
}

/**
 * Generic polling hook that fetches a URL on an interval.
 * Returns stale data while a refresh is in flight.
 * Cleans up via AbortController on unmount or URL change.
 */
export function usePolling<T>(
  url: string,
  intervalMs: number,
  options: PollingOptions = {}
): PollingResult<T> {
  const { enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Track whether we have received any data yet (to distinguish initial load)
  const hasData = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let abortController = new AbortController();
    let intervalId: ReturnType<typeof setInterval>;

    async function fetchData() {
      // Only show loading spinner on initial fetch
      if (!hasData.current) {
        setIsLoading(true);
      }

      try {
        const res = await fetch(url, { signal: abortController.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const json: T = await res.json();
        setData(json);
        setError(null);
        hasData.current = true;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    }

    // Fetch immediately on mount
    fetchData();

    intervalId = setInterval(() => {
      // Recreate controller for each interval tick
      abortController = new AbortController();
      fetchData();
    }, intervalMs);

    return () => {
      abortController.abort();
      clearInterval(intervalId);
      hasData.current = false;
    };
  }, [url, intervalMs, enabled]);

  return { data, error, isLoading };
}
