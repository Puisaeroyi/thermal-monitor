"use client";

import { Globe, GripVertical } from "lucide-react";
import type { DashboardPanel } from "@/hooks/use-dashboard-layout";

interface Group {
  id: string;
  name: string;
  color: string;
  cameraCount: number;
}

interface DashboardDragPaletteProps {
  groups: Group[];
  activePanelIds: string[];
}

/** Draggable chip for "All Cameras" or a specific group */
function DragChip({
  panel,
  label,
  color,
  disabled,
}: {
  panel: DashboardPanel;
  label: string;
  color?: string;
  disabled: boolean;
}) {
  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("application/json", JSON.stringify(panel));
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    <div
      draggable={!disabled}
      onDragStart={handleDragStart}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium
        transition-all select-none
        ${disabled
          ? "opacity-40 cursor-not-allowed bg-muted"
          : "cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/50 bg-background"
        }
      `}
    >
      <GripVertical className="size-3.5 text-muted-foreground shrink-0" />
      {color ? (
        <div className="size-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
      ) : (
        <Globe className="size-3.5 text-primary shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </div>
  );
}

/** Sidebar palette of draggable group chips + "All Cameras" */
export function DashboardDragPalette({ groups, activePanelIds }: DashboardDragPaletteProps) {
  const allPanel: DashboardPanel = { id: "__all__", type: "all" };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Drag to dashboard
      </p>

      {/* All Cameras chip */}
      <DragChip
        panel={allPanel}
        label="All Cameras"
        disabled={activePanelIds.includes("__all__")}
      />

      {/* Group chips */}
      {groups.map((g) => {
        const panel: DashboardPanel = {
          id: `group-${g.id}`,
          type: "group",
          groupId: g.id,
          groupName: g.name,
          groupColor: g.color,
        };
        return (
          <DragChip
            key={g.id}
            panel={panel}
            label={`${g.name} (${g.cameraCount})`}
            color={g.color}
            disabled={activePanelIds.includes(panel.id)}
          />
        );
      })}

      {groups.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No groups yet. Create groups in the Cameras page.
        </p>
      )}
    </div>
  );
}
