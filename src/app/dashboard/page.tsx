"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, MapPin } from "lucide-react";
import Link from "next/link";
import { useCameras } from "@/hooks/use-cameras";
import { useDashboardLayout } from "@/hooks/use-dashboard-layout";
import { StatusSummary } from "@/components/dashboard/status-summary";
import { DashboardDragPalette } from "@/components/dashboard/dashboard-drag-palette";
import { DashboardDropZone } from "@/components/dashboard/dashboard-drop-zone";
import { Button } from "@/components/ui/button";
import type { TempUnit } from "@/components/layout/header";

const UNIT_KEY = "thermal-temp-unit";

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
  const [unit, setUnit] = useState<TempUnit>("C");
  const [alertStats, setAlertStats] = useState({ total: 0, acknowledged: 0, unacknowledged: 0 });
  const [groups, setGroups] = useState<Group[]>([]);

  // Sync temperature unit from localStorage (set by header)
  useEffect(() => {
    function syncUnit() {
      const stored = localStorage.getItem(UNIT_KEY) as TempUnit | null;
      if (stored === "C" || stored === "F") setUnit(stored);
    }
    syncUnit();
    window.addEventListener("storage", syncUnit);
    return () => window.removeEventListener("storage", syncUnit);
  }, []);

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

  // Fetch alert stats once on mount
  useEffect(() => {
    async function fetchAlertStats() {
      try {
        const res = await fetch("/api/alerts?stats=true");
        if (!res.ok) return;
        const data = await res.json();
        setAlertStats(data);
      } catch {
        // Non-critical
      }
    }
    fetchAlertStats();
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
          <StatusSummary cameras={cameras} alertStats={alertStats} />

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

          {/* Navigation section */}
          {groups.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Navigation</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {groups.map((group) => (
                  <Link key={group.id} href={`/groups/${group.id}`}>
                    <Button
                      variant="outline"
                      className="gap-2"
                      style={{ borderColor: group.color, color: group.color }}
                    >
                      <MapPin className="size-4" />
                      {group.name}
                    </Button>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
