"use client";

import { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera } from "@/types/camera";
import { Download, CalendarRange, CheckSquare, Loader2, ChevronDown, ChevronRight } from "lucide-react";

interface ExportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    cameras: Camera[];
}

interface CameraGroup {
    id: string;
    name: string;
    color: string | null;
    cameras: Camera[];
}

export function ExportModal({ open, onOpenChange, cameras }: ExportModalProps) {
    // ---------- date range state ----------
    const today = new Date().toISOString().split("T")[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [isExporting, setIsExporting] = useState(false);

    // ---------- camera selection state ----------
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // ---------- group collapse state ----------
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    // Pre-select all cameras when the modal opens
    useEffect(() => {
        if (open) {
            setSelectedIds(new Set(cameras.map((c) => c.cameraId)));
            setCollapsedGroups(new Set()); // expand all groups on open
        }
    }, [open, cameras]);

    // ---------- group cameras by zone ----------
    const groups = useMemo<CameraGroup[]>(() => {
        const map = new Map<string, CameraGroup>();

        for (const cam of cameras) {
            const key = cam.group?.id ?? "__none__";
            if (!map.has(key)) {
                map.set(key, {
                    id: key,
                    name: cam.group?.name ?? "Unassigned",
                    color: cam.group?.color ?? null,
                    cameras: [],
                });
            }
            map.get(key)!.cameras.push(cam);
        }

        // Sort: named groups alphabetically, "Unassigned" last
        return Array.from(map.values()).sort((a, b) => {
            if (a.id === "__none__") return 1;
            if (b.id === "__none__") return -1;
            return a.name.localeCompare(b.name);
        });
    }, [cameras]);

    // ---------- global select state ----------
    const allSelected = cameras.length > 0 && selectedIds.size === cameras.length;
    const someSelected = selectedIds.size > 0 && !allSelected;

    function toggleAll() {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(cameras.map((c) => c.cameraId)));
        }
    }

    // ---------- group-level toggle ----------
    function groupState(group: CameraGroup): "all" | "some" | "none" {
        const checked = group.cameras.filter((c) => selectedIds.has(c.cameraId)).length;
        if (checked === 0) return "none";
        if (checked === group.cameras.length) return "all";
        return "some";
    }

    function toggleGroup(group: CameraGroup) {
        const state = groupState(group);
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (state === "all") {
                group.cameras.forEach((c) => next.delete(c.cameraId));
            } else {
                group.cameras.forEach((c) => next.add(c.cameraId));
            }
            return next;
        });
    }

    // ---------- camera-level toggle ----------
    function toggleRow(cameraId: string) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(cameraId)) {
                next.delete(cameraId);
            } else {
                next.add(cameraId);
            }
            return next;
        });
    }

    // ---------- collapse toggle ----------
    function toggleCollapse(groupId: string) {
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            return next;
        });
    }

    // ---------- selected cameras list ----------
    const selectedCameras = useMemo(
        () => cameras.filter((c) => selectedIds.has(c.cameraId)),
        [cameras, selectedIds]
    );

    // ---------- export ----------
    async function handleExport() {
        setIsExporting(true);
        try {
            const cameraIds = Array.from(selectedIds).join(",");
            const statsRes = await fetch(
                `/api/readings/stats?cameraIds=${encodeURIComponent(cameraIds)}&from=${startDate}&to=${endDate}`
            );
            const stats: Record<string, { avg: number | null; min: number | null; max: number | null }> =
                await statsRes.json();

            const now = new Date();
            const exportDateUTC = now.toISOString().split("T")[0];
            const exportTimeUTC = now.toISOString().split("T")[1].replace("Z", "").split(".")[0];

            // Sort selected cameras by group name then camera name for logical output
            const sorted = [...selectedCameras].sort((a, b) => {
                const ga = a.group?.name ?? "ZZZ";
                const gb = b.group?.name ?? "ZZZ";
                if (ga !== gb) return ga.localeCompare(gb);
                return a.name.localeCompare(b.name);
            });

            const rows = sorted.map((c) => {
                const s = stats[c.cameraId] || { avg: null, min: null, max: null };
                return {
                    "Camera Name": c.name,
                    Zone: c.group?.name ?? "Unassigned",
                    Location: c.location ?? "—",
                    "IP Address": c.ipAddress ?? "—",
                    "Date (UTC)": exportDateUTC,
                    "Timestamp (UTC)": exportTimeUTC,
                    "Avg Temperature (°C)": s.avg ?? "—",
                    "Min Temperature (°C)": s.min ?? "—",
                    "Max Temperature (°C)": s.max ?? "—",
                };
            });

            const ws = XLSX.utils.json_to_sheet(rows);
            const colWidths = [
                { wch: 24 }, // Camera Name
                { wch: 18 }, // Zone
                { wch: 20 }, // Location
                { wch: 16 }, // IP Address
                { wch: 14 }, // Date (UTC)
                { wch: 16 }, // Timestamp (UTC)
                { wch: 22 }, // Avg Temp
                { wch: 22 }, // Min Temp
                { wch: 22 }, // Max Temp
            ];
            ws["!cols"] = colWidths;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Cameras");

            const filename = `cameras_export_${startDate}_to_${endDate}.xlsx`;
            XLSX.writeFile(wb, filename);

            onOpenChange(false);
        } catch (error) {
            console.error("Export failed:", error);
            alert("Failed to export. Please try again.");
        } finally {
            setIsExporting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:!max-w-[850px] w-[95vw] flex flex-col gap-0 p-0 overflow-hidden">
                {/* ───── Header ───── */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Download className="size-5 text-primary" />
                        Export Settings
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-5 px-6 py-5 overflow-y-auto">
                    {/* ───── Date Range ───── */}
                    <section className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <CalendarRange className="size-4 text-muted-foreground" />
                            Time Filter
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 flex flex-col gap-1.5">
                                <label
                                    htmlFor="export-start-date"
                                    className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                                >
                                    Start Date
                                </label>
                                <input
                                    id="export-start-date"
                                    type="date"
                                    value={startDate}
                                    max={endDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-foreground"
                                />
                            </div>
                            <div className="flex items-end pb-1.5 text-muted-foreground text-sm font-medium hidden sm:flex">
                                →
                            </div>
                            <div className="flex-1 flex flex-col gap-1.5">
                                <label
                                    htmlFor="export-end-date"
                                    className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                                >
                                    End Date
                                </label>
                                <input
                                    id="export-end-date"
                                    type="date"
                                    value={endDate}
                                    min={startDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-foreground"
                                />
                            </div>
                        </div>
                    </section>

                    {/* ───── Camera Selection ───── */}
                    <section className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <CheckSquare className="size-4 text-muted-foreground" />
                                Camera Selection
                            </div>
                            <span className="text-xs text-muted-foreground">
                                {selectedIds.size} / {cameras.length} selected
                            </span>
                        </div>

                        <div className="rounded-md border overflow-hidden">
                            {/* Sticky table header */}
                            <div className="bg-muted/80 backdrop-blur-sm border-b">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr>
                                            <th className="w-10 px-3 py-2.5 text-left">
                                                <input
                                                    id="export-select-all"
                                                    type="checkbox"
                                                    checked={allSelected}
                                                    ref={(el) => {
                                                        if (el) el.indeterminate = someSelected;
                                                    }}
                                                    onChange={toggleAll}
                                                    className="size-4 rounded accent-primary cursor-pointer"
                                                    aria-label="Select all cameras"
                                                />
                                            </th>
                                            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide text-xs">
                                                Camera Name
                                            </th>
                                            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide text-xs">
                                                Location
                                            </th>
                                            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide text-xs w-28">
                                                IP Address
                                            </th>
                                        </tr>
                                    </thead>
                                </table>
                            </div>

                            {/* Scrollable grouped body */}
                            <div className="overflow-y-auto max-h-72 bg-background">
                                {cameras.length === 0 ? (
                                    <div className="px-3 py-8 text-center text-muted-foreground text-sm">
                                        No cameras available
                                    </div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <tbody>
                                            {groups.map((group) => {
                                                const state = groupState(group);
                                                const isCollapsed = collapsedGroups.has(group.id);

                                                return (
                                                    <>
                                                        {/* ── Group Header Row ── */}
                                                        <tr
                                                            key={`group-${group.id}`}
                                                            className="bg-muted/40 border-b border-t select-none"
                                                        >
                                                            <td className="w-10 px-3 py-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={state === "all"}
                                                                    ref={(el) => {
                                                                        if (el) el.indeterminate = state === "some";
                                                                    }}
                                                                    onChange={() => toggleGroup(group)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="size-4 rounded accent-primary cursor-pointer"
                                                                    aria-label={`Select all in ${group.name}`}
                                                                />
                                                            </td>
                                                            <td
                                                                colSpan={3}
                                                                className="px-3 py-2 cursor-pointer"
                                                                onClick={() => toggleCollapse(group.id)}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    {isCollapsed
                                                                        ? <ChevronRight className="size-3.5 text-muted-foreground" />
                                                                        : <ChevronDown className="size-3.5 text-muted-foreground" />
                                                                    }
                                                                    {/* Zone color dot */}
                                                                    {group.color && group.id !== "__none__" && (
                                                                        <span
                                                                            className="inline-block size-2 rounded-full flex-shrink-0"
                                                                            style={{ backgroundColor: group.color }}
                                                                        />
                                                                    )}
                                                                    <span className="font-semibold text-xs uppercase tracking-wide text-foreground">
                                                                        {group.name}
                                                                    </span>
                                                                    <span className="text-xs text-muted-foreground font-normal">
                                                                        ({group.cameras.filter(c => selectedIds.has(c.cameraId)).length}/{group.cameras.length})
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        </tr>

                                                        {/* ── Camera Rows ── */}
                                                        {!isCollapsed && group.cameras.map((cam) => {
                                                            const isChecked = selectedIds.has(cam.cameraId);
                                                            return (
                                                                <tr
                                                                    key={cam.cameraId}
                                                                    className={`border-b last:border-b-0 cursor-pointer transition-colors hover:bg-muted/50 ${isChecked ? "bg-primary/5" : ""}`}
                                                                    onClick={() => toggleRow(cam.cameraId)}
                                                                >
                                                                    <td className="w-10 px-3 py-2.5 pl-8">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isChecked}
                                                                            onChange={() => toggleRow(cam.cameraId)}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="size-4 rounded accent-primary cursor-pointer"
                                                                            aria-label={`Select ${cam.name}`}
                                                                        />
                                                                    </td>
                                                                    <td className="px-3 py-2.5 font-medium">
                                                                        {cam.name}
                                                                    </td>
                                                                    <td className="px-3 py-2.5 text-muted-foreground text-xs">
                                                                        {cam.location ?? "—"}
                                                                    </td>
                                                                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground w-28">
                                                                        {cam.ipAddress ?? "—"}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </section>
                </div>

                {/* ───── Footer ───── */}
                <DialogFooter className="px-6 py-4 border-t bg-muted/30 flex-row justify-end gap-2">
                    <Button
                        id="export-cancel-btn"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        id="export-now-btn"
                        onClick={handleExport}
                        disabled={selectedIds.size === 0 || isExporting}
                        className="gap-2"
                    >
                        {isExporting ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Download className="size-4" />
                        )}
                        {isExporting ? "Exporting..." : "Export now"}
                        {!isExporting && selectedIds.size > 0 && (
                            <span className="ml-1 opacity-75 text-xs">
                                ({selectedIds.size})
                            </span>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
