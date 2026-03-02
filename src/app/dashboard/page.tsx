"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { useCameras } from "@/hooks/use-cameras";
import { useDashboardLayout } from "@/hooks/use-dashboard-layout";
import { StatusSummary } from "@/components/dashboard/status-summary";
import { DashboardDragPalette } from "@/components/dashboard/dashboard-drag-palette";
import { DashboardDropZone } from "@/components/dashboard/dashboard-drop-zone";
import { Button } from "@/components/ui/button";
import { useTempUnit } from "@/contexts/temp-unit-context";

interface Group {
  id: string;
  name: string;
  color: string;
  cameraCount: number;
}

/** Loading skeleton for initial data fetch */
function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-36 rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

/** Main dashboard page — drag-and-drop customizable layout */
export default function DashboardPage() {
  const { cameras, thresholds, isLoading, error } = useCameras();
  const { panels, loaded, addPanel, removePanel, clearAll } = useDashboardLayout();
  const { unit } = useTempUnit();
  const [alertCount, setAlertCount] = useState(0);
  const [groups, setGroups] = useState<Group[]>([]);

  // Fetch groups for the drag palette
  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/groups");
      if (!res.ok) return;
      setGroups(await res.json());
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Fetch unacknowledged alert count once on mount
  useEffect(() => {
    async function fetchAlertCount() {
      try {
        const res = await fetch("/api/alerts?count=unacknowledged");
        if (!res.ok) return;
        const data = await res.json();
        setAlertCount(typeof data.count === "number" ? data.count : 0);
      } catch {
        // Non-critical
      }
    }
    fetchAlertCount();
  }, []);

  const activePanelIds = panels.map((p) => p.id);

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drag groups to build your monitoring view
          </p>
        </div>
        {panels.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearAll}>
            <Trash2 className="size-3.5 mr-1.5" />
            Clear All
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load camera data: {error.message}
        </div>
      )}

      {isLoading || !loaded ? (
        <DashboardSkeleton />
      ) : (
        <>
          <StatusSummary cameras={cameras} alertCount={alertCount} />

          <div className="flex gap-6">
            {/* Left: drag palette */}
            <div className="w-52 shrink-0 hidden md:block">
              <DashboardDragPalette groups={groups} activePanelIds={activePanelIds} />
            </div>

            {/* Right: drop zone canvas */}
            <DashboardDropZone
              panels={panels}
              cameras={cameras}
              thresholds={thresholds}
              unit={unit}
              onDrop={addPanel}
              onRemove={removePanel}
            />
          </div>

          {/* Mobile: show palette below as a horizontal scroll */}
          <div className="md:hidden">
            <DashboardDragPalette groups={groups} activePanelIds={activePanelIds} />
          </div>
        </>
      )}
    </div>
  );
}
