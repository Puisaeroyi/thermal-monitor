"use client";

import { useEffect, useState } from "react";
import { usePolling } from "@/hooks/use-polling";
import type { TemperatureThreshold } from "@/types/threshold";

export interface CameraReading {
  cameraId: string;
  name: string;
  location: string;
  status: "ACTIVE" | "INACTIVE";
  groupId: string | null;
  celsius: number | null;
  timestamp: string | null;
}

export interface UseCamerasResult {
  cameras: CameraReading[];
  thresholds: TemperatureThreshold[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Wraps usePolling to fetch latest camera readings at 5s interval.
 * Also fetches temperature thresholds once on mount for color coding.
 */
export function useCameras(): UseCamerasResult {
  const [thresholds, setThresholds] = useState<TemperatureThreshold[]>([]);

  // Poll latest readings every 5 seconds
  const {
    data: cameras,
    error,
    isLoading,
  } = usePolling<CameraReading[]>("/api/readings/latest", 5000);

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
    cameras: cameras ?? [],
    thresholds,
    isLoading,
    error,
  };
}
