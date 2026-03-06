"use client";

import { useEffect, useState, useCallback } from "react";
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
  timestamp: string | null;

  // 🔥 Added for mini chart
  history?: {
    timestamp: string;
    celsius: number;
  }[];
}

export interface UseCamerasResult {
  cameras: CameraReading[];
  thresholds: TemperatureThreshold[];
  isLoading: boolean;
  error: Error | null;
}

export function useCameras(): UseCamerasResult {
  const [thresholds, setThresholds] = useState<TemperatureThreshold[]>([]);
  const [cameras, setCameras] = useState<CameraReading[]>([]);
  const sseSource = useSSE();

  /**
   * Merge incoming readings into previous state
   * and keep last 20 temperature points per camera
   */
  const mergeHistory = useCallback(
  (prev: CameraReading[], incoming: CameraReading[]): CameraReading[] => {
    const prevMap = new Map(prev.map((c) => [c.cameraId, c]));

    // remove duplicates from incoming
    const incomingMap = new Map(
      incoming.map((c) => [c.cameraId, c])
    );

    incomingMap.forEach((cam) => {
      const existing = prevMap.get(cam.cameraId);

      const newHistory = [
        ...(existing?.history ?? []),
        ...(cam.celsius !== null && cam.timestamp
          ? [{ timestamp: cam.timestamp, celsius: cam.celsius }]
          : []),
      ]
        .filter(
          (v, i, arr) =>
            arr.findIndex((x) => x.timestamp === v.timestamp) === i
        )
        .slice(-20);

      prevMap.set(cam.cameraId, {
        ...cam,
        history: newHistory,
      });
    });

    return Array.from(prevMap.values());
  },
  []
);

  // ========================
  // SSE PRIMARY SOURCE
  // ========================
  useEffect(() => {
    if (!sseSource) return;

    const handler = (e: MessageEvent) => {
      try {
        const data: CameraReading[] = JSON.parse(e.data);

        setCameras((prev) => mergeHistory(prev, data));
      } catch (err) {
        console.error("[use-cameras] SSE parse error:", err);
      }
    };

    sseSource.addEventListener("readings", handler);
    return () => sseSource.removeEventListener("readings", handler);
  }, [sseSource, mergeHistory]);

  // ========================
  // POLLING FALLBACK
  // ========================
  const {
    data: polledCameras,
    error: pollingError,
    isLoading: pollingLoading,
  } = usePolling<CameraReading[]>("/api/readings/latest", POLLING_INTERVAL_MS, {
    enabled: !sseSource,
  });

  useEffect(() => {
    if (polledCameras && !sseSource) {
      setCameras((prev) => mergeHistory(prev, polledCameras));
    }
  }, [polledCameras, sseSource, mergeHistory]);

  // ========================
  // FETCH THRESHOLDS (once)
  // ========================
  useEffect(() => {
    async function fetchThresholds() {
      try {
        const res = await fetch("/api/thresholds/temperature");
        if (!res.ok) return;

        const data: TemperatureThreshold[] = await res.json();
        setThresholds(data);
      } catch {
        // non-critical
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
