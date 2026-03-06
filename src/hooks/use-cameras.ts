"use client";

import { useEffect, useState } from "react";
import { useSSE } from "@/hooks/use-sse";
import { usePolling } from "@/hooks/use-polling";
import type { TemperatureThreshold } from "@/types/threshold";
import { POLLING_INTERVAL_MS } from "@/lib/constants";

export interface CameraReading {
  cameraId: string;
  name: string;
  location: string;
  status: "ACTIVE" | "INACTIVE";
  groupId: string | null;
  celsius: number | null;
  maxCelsius?: number | null;
  minCelsius?: number | null;
  timestamp: string | null;
}

export interface UseCamerasResult {
  cameras: CameraReading[];
  thresholds: TemperatureThreshold[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Uses SSE for real-time camera readings with polling fallback.
 * Fetches temperature thresholds once on mount for color coding.
 */
export function useCameras(): UseCamerasResult {
  const [thresholds, setThresholds] = useState<TemperatureThreshold[]>([]);
  const [cameras, setCameras] = useState<CameraReading[]>([]);
  const sseSource = useSSE();

  // SSE primary: listen for readings events
  useEffect(() => {
    if (!sseSource) return;

    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setCameras(data);
      } catch (err) {
        console.error("[use-cameras] SSE parse error:", err);
      }
    };

    sseSource.addEventListener("readings", handler);
    return () => sseSource.removeEventListener("readings", handler);
  }, [sseSource]);

  // Fallback to polling if SSE unavailable
  const {
    data: polledCameras,
    error: pollingError,
    isLoading: pollingLoading,
  } = usePolling<CameraReading[]>("/api/readings/latest", POLLING_INTERVAL_MS, {
    enabled: !sseSource,
  });

  useEffect(() => {
    if (polledCameras && !sseSource) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCameras(polledCameras);
    }
  }, [polledCameras, sseSource]);

  // Fetch thresholds once on mount
  useEffect(() => {
    async function fetchThresholds() {
      try {
        const res = await fetch("/api/thresholds/temperature");
        if (!res.ok) return;
        const data: TemperatureThreshold[] = await res.json();
        setThresholds(data);
      } catch {
        // Non-critical — color coding falls back to "normal"
      }
    }
    fetchThresholds();
  }, []);

  return {
    cameras,
    thresholds,
    isLoading: !sseSource && pollingLoading,
    error: pollingError,
  };
}
