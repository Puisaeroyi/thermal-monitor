"use client";

import { useState, useCallback, useEffect } from "react";

/** Key for localStorage persistence */
const LAYOUT_KEY = "thermal-dashboard-layout";

/** A panel on the dashboard — either "all" cameras or a specific group */
export interface DashboardPanel {
  id: string;
  type: "all" | "group";
  groupId?: string;
  groupName?: string;
  groupColor?: string;
}

/**
 * Manages dashboard layout state with localStorage persistence.
 * Starts empty — users drag groups or "All Cameras" to build their view.
 */
export function useDashboardLayout() {
  const [panels, setPanels] = useState<DashboardPanel[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Restore layout from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAYOUT_KEY);
      if (stored) setPanels(JSON.parse(stored));
    } catch {
      // Corrupted data — start fresh
    }
    setLoaded(true);
  }, []);

  // Persist whenever panels change (skip initial load)
  useEffect(() => {
    if (loaded) localStorage.setItem(LAYOUT_KEY, JSON.stringify(panels));
  }, [panels, loaded]);

  const addPanel = useCallback((panel: DashboardPanel) => {
    setPanels((prev) => {
      // Prevent duplicates
      if (prev.some((p) => p.id === panel.id)) return prev;
      return [...prev, panel];
    });
  }, []);

  const removePanel = useCallback((panelId: string) => {
    setPanels((prev) => prev.filter((p) => p.id !== panelId));
  }, []);

  const reorderPanels = useCallback((fromIndex: number, toIndex: number) => {
    setPanels((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setPanels([]), []);

  return { panels, loaded, addPanel, removePanel, reorderPanels, clearAll };
}
