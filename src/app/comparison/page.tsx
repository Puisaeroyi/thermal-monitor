"use client";

import { useState, useEffect, useCallback } from "react";
import { Camera } from "@/types/camera";
import { Reading } from "@/types/reading";
import { ComparisonChart } from "@/components/charts/comparison-chart";
import { TimeRangeSelector } from "@/components/charts/time-range-selector";
import { Card } from "@/components/ui/card";

const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#9333ea"];
const MAX_CAMERAS = 5;

interface CameraDataset {
  cameraId: string;
  name: string;
  readings: Reading[];
  color: string;
}

/** Comparison page — select up to 5 cameras and compare their temperature histories. */
export default function ComparisonPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [datasets, setDatasets] = useState<CameraDataset[]>([]);
  const [timeRange, setTimeRange] = useState(60);
  const [isLoadingCameras, setIsLoadingCameras] = useState(true);
  const [isLoadingReadings, setIsLoadingReadings] = useState(false);

  useEffect(() => {
    fetch("/api/cameras")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Camera[]) => setCameras(data))
      .catch(() => {})
      .finally(() => setIsLoadingCameras(false));
  }, []);

  const fetchReadings = useCallback(async () => {
    if (selected.size === 0) {
      setDatasets([]);
      return;
    }
    setIsLoadingReadings(true);
    const from = new Date(Date.now() - timeRange * 60 * 1000).toISOString();
    try {
      const results = await Promise.all(
        Array.from(selected).map(async (cameraId, i) => {
          const res = await fetch(
            `/api/readings?cameraId=${encodeURIComponent(cameraId)}&from=${encodeURIComponent(from)}&limit=360`
          );
          const readings: Reading[] = res.ok ? await res.json() : [];
          const cam = cameras.find((c) => c.cameraId === cameraId);
          return {
            cameraId,
            name: cam?.name ?? cameraId,
            readings: readings.sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            ),
            color: COLORS[i % COLORS.length],
          };
        })
      );
      setDatasets(results);
    } catch {
      // silent
    } finally {
      setIsLoadingReadings(false);
    }
  }, [selected, timeRange, cameras]);

  useEffect(() => {
    fetchReadings();
    const id = setInterval(fetchReadings, 10000);
    return () => clearInterval(id);
  }, [fetchReadings]);

  function toggleCamera(cameraId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cameraId)) {
        next.delete(cameraId);
      } else if (next.size < MAX_CAMERAS) {
        next.add(cameraId);
      }
      return next;
    });
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Camera Comparison</h1>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      <div>
        <h2 className="text-sm font-medium mb-2 text-muted-foreground">
          Select cameras (max {MAX_CAMERAS}):
        </h2>
        {isLoadingCameras ? (
          <p className="text-muted-foreground text-sm">Loading cameras…</p>
        ) : cameras.length === 0 ? (
          <p className="text-muted-foreground text-sm">No cameras available.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {cameras.map((cam, i) => {
              const isChecked = selected.has(cam.cameraId);
              const isDisabled = !isChecked && selected.size >= MAX_CAMERAS;
              return (
                <button
                  key={cam.cameraId}
                  onClick={() => toggleCamera(cam.cameraId)}
                  disabled={isDisabled}
                  className={[
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                    isChecked
                      ? "text-white border-transparent"
                      : "border-border text-foreground hover:bg-muted",
                    isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                  style={isChecked ? { backgroundColor: COLORS[Array.from(selected).indexOf(cam.cameraId) % COLORS.length] } : {}}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: isChecked ? "white" : COLORS[i % COLORS.length] }}
                  />
                  {cam.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Card className="p-4">
        {isLoadingReadings ? (
          <div className="flex h-[400px] items-center justify-center text-muted-foreground text-sm">
            Loading readings…
          </div>
        ) : (
          <ComparisonChart datasets={datasets} />
        )}
      </Card>
    </div>
  );
}
