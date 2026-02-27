"use client";

import { useState, useEffect, use } from "react";
import { Camera } from "@/types/camera";
import { Reading } from "@/types/reading";
import { TemperatureThreshold, GapThreshold } from "@/types/threshold";
import { useReadings } from "@/hooks/use-readings";
import { CameraInfoHeader } from "@/components/cameras/camera-info-header";
import { TimeRangeSelector } from "@/components/charts/time-range-selector";
import { TemperatureLineChart } from "@/components/charts/temperature-line-chart";
import { GapBarChart } from "@/components/charts/gap-bar-chart";
import { Card } from "@/components/ui/card";

interface PageProps {
  params: Promise<{ cameraId: string }>;
}

/** Camera detail page showing live temperature chart and gap analysis. */
export default function CameraDetailPage({ params }: PageProps) {
  const { cameraId } = use(params);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [tempThresholds, setTempThresholds] = useState<TemperatureThreshold[]>([]);
  const [gapThresholds, setGapThresholds] = useState<GapThreshold[]>([]);
  const [timeRange, setTimeRange] = useState(60);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const { readings, isLoading } = useReadings(cameraId, timeRange);

  useEffect(() => {
    async function fetchStatic() {
      try {
        const [camRes, tempRes, gapRes] = await Promise.all([
          fetch(`/api/cameras/${encodeURIComponent(cameraId)}`),
          fetch("/api/thresholds/temperature"),
          fetch("/api/thresholds/gap"),
        ]);
        if (!camRes.ok) {
          setCameraError("Camera not found");
          return;
        }
        setCamera(await camRes.json());
        setTempThresholds(tempRes.ok ? await tempRes.json() : []);
        setGapThresholds(gapRes.ok ? await gapRes.json() : []);
      } catch {
        setCameraError("Failed to load camera");
      }
    }
    fetchStatic();
  }, [cameraId]);

  const latestReading: Reading | null = readings.length > 0 ? readings[readings.length - 1] : null;

  const relevantTempThresholds = tempThresholds
    .filter((t) => t.enabled && (t.cameraId === null || t.cameraId === cameraId))
    .map((t) => ({ name: t.name, maxCelsius: t.maxCelsius ?? undefined, minCelsius: t.minCelsius ?? undefined }));

  const relevantGapThresholds = gapThresholds
    .filter((t) => t.enabled && (t.cameraId === null || t.cameraId === cameraId))
    .map((t) => ({ intervalMinutes: t.intervalMinutes, maxGapCelsius: t.maxGapCelsius, name: t.name }));

  if (cameraError) {
    return (
      <div className="p-6">
        <p className="text-destructive">{cameraError}</p>
      </div>
    );
  }

  if (!camera) {
    return <div className="p-6 text-muted-foreground text-sm">Loading camera…</div>;
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      <CameraInfoHeader camera={camera} latestReading={latestReading} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Temperature History</h2>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      <Card className="p-4">
        {isLoading ? (
          <div className="flex h-[400px] items-center justify-center text-muted-foreground text-sm">
            Loading readings…
          </div>
        ) : (
          <TemperatureLineChart readings={readings} thresholds={relevantTempThresholds} />
        )}
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-3">Temperature Change (Gap Analysis)</h2>
        <Card className="p-4">
          <GapBarChart readings={readings} gapThresholds={relevantGapThresholds} />
        </Card>
      </div>
    </div>
  );
}
