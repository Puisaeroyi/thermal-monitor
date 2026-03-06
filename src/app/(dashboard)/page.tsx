"use client";

import { useState, useEffect } from "react";
import { useCameras } from "@/hooks/use-cameras";
import { useTempUnit } from "@/contexts/temp-unit-context";

import { CameraOverview } from "@/components/dashboard/overview-summary";
import { AlertOverview } from "@/components/dashboard/alert-summary";
import { GroupCameraGrid } from "@/components/dashboard/group-camera-grid";

export default function DashboardPage() {

  const { cameras, thresholds, isLoading, error } = useCameras();
  const { unit } = useTempUnit();

  const [groups, setGroups] = useState<any[]>([]);

  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch("/api/groups");
        if (!res.ok) return;

        const data = await res.json();
        setGroups(data);
      } catch {}
    }

    fetchGroups();
  }, []);

  if (isLoading) {
    return <div className="p-6">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-red-500">
        Failed to load camera data
      </div>
    );
  }

  return (
  <div className="p-8 space-y-8 max-w-[1600px] mx-auto">

    {/* TITLE */}
    <div className="space-y-1">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Monitoring overview
      </p>
    </div>

    {/* OVERVIEW */}
    <div className="grid grid-cols-2 gap-8">
      <CameraOverview />
      <AlertOverview />
    </div>

    {/* CAMERA GROUPS */}
    <GroupCameraGrid
      groups={groups}
      cameras={cameras}
      thresholds={thresholds}
      unit={unit}
    />

  </div>
);
}