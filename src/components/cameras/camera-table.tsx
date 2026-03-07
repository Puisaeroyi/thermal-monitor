"use client";

import { useState, useMemo } from "react";
import { Camera } from "@/types/camera";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Search, X, RotateCcw, Download, Plus, PlusCircle } from "lucide-react";

interface CameraWithTemp extends Camera {
  celsius?: number | null;
  timestamp?: string | null;
}

interface CameraTableProps {
  cameras: CameraWithTemp[];
  onEdit: (camera: Camera) => void;
  onDelete: (cameraId: string) => void;
  onRefresh: () => void;
  onExport: () => void;
  onAddGroup: () => void;
  onAddCamera: () => void;
  canWrite?: boolean;
}

/** Table listing all cameras with search, zone filter, sync-all, and action buttons. */
export function CameraTable({
  cameras,
  onEdit,
  onDelete,
  onRefresh,
  onExport,
  onAddGroup,
  onAddCamera,
  canWrite = true
}: CameraTableProps) {
  // ---------- per-row sync state ----------
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, { ok: boolean; msg: string }>>({});

  // ---------- sync-all state ----------
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllProgress, setSyncAllProgress] = useState<{ done: number; total: number } | null>(null);

  // ---------- search & filter state ----------
  const [searchQuery, setSearchQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState("all");

  // ---------- derive zones from camera list ----------
  const zones = useMemo(() => {
    const map = new Map<string, string>();
    for (const cam of cameras) {
      if (cam.group) map.set(cam.group.id, cam.group.name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [cameras]);

  // ---------- filtered cameras ----------
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cameras.filter((cam) => {
      // Zone filter
      if (zoneFilter !== "all") {
        if (!cam.group || cam.group.id !== zoneFilter) return false;
      }
      // Text search: name / IP / location
      if (q) {
        const haystack = [cam.name, cam.ipAddress ?? "", cam.location ?? ""].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [cameras, searchQuery, zoneFilter]);

  const hasFilters = searchQuery.trim() !== "" || zoneFilter !== "all";

  // ---------- per-row sync ----------
  async function handleSync(cameraId: string) {
    setSyncingId(cameraId);
    setSyncResults((prev) => ({ ...prev, [cameraId]: { ok: false, msg: "" } }));
    try {
      const res = await fetch("/api/sunapi/device-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cameraId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncResults((prev) => ({ ...prev, [cameraId]: { ok: false, msg: data.error ?? "Failed" } }));
      } else {
        setSyncResults((prev) => ({ ...prev, [cameraId]: { ok: true, msg: `Synced: ${data.model}` } }));
        onRefresh();
      }
    } catch {
      setSyncResults((prev) => ({ ...prev, [cameraId]: { ok: false, msg: "Network error" } }));
    } finally {
      setSyncingId(null);
    }
  }

  // ---------- sync all ----------
  async function handleSyncAll() {
    const targets = cameras.filter((c) => c.ipAddress);
    if (targets.length === 0) return;

    setSyncingAll(true);
    setSyncAllProgress({ done: 0, total: targets.length });
    setSyncResults({});

    let done = 0;
    await Promise.all(
      targets.map(async (cam) => {
        try {
          const res = await fetch("/api/sunapi/device-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cameraId: cam.cameraId }),
          });
          const data = await res.json();
          setSyncResults((prev) => ({
            ...prev,
            [cam.cameraId]: res.ok
              ? { ok: true, msg: `Synced: ${data.model}` }
              : { ok: false, msg: data.error ?? "Failed" },
          }));
        } catch {
          setSyncResults((prev) => ({
            ...prev,
            [cam.cameraId]: { ok: false, msg: "Network error" },
          }));
        } finally {
          done++;
          setSyncAllProgress({ done, total: targets.length });
        }
      })
    );

    setSyncingAll(false);
    setSyncAllProgress(null);
    onRefresh();
  }

  // ---------- clear all filters ----------
  function clearFilters() {
    setSearchQuery("");
    setZoneFilter("all");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-0 w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            id="camera-search"
            placeholder="Search by name, IP or location…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-8"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Zone filter */}
        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger id="camera-zone-filter" className="w-full sm:w-44">
            <SelectValue placeholder="All Zones" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Zones</SelectItem>
            {zones.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
            <RotateCcw className="size-3.5" />
            Clear
          </Button>
        )}

        {/* Actions — pushed to right */}
        <div className="sm:ml-auto flex items-center gap-2">
          {syncAllProgress && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {syncAllProgress.done}/{syncAllProgress.total} synced
            </span>
          )}
          <Button
            id="sync-all-btn"
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            disabled={syncingAll || syncingId !== null}
            className="gap-1.5 whitespace-nowrap border-green-600 text-green-600 hover:bg-green-50 hover:text-green-700"
          >
            <RefreshCw className={`size-3.5 ${syncingAll ? "animate-spin" : ""}`} />
            {syncingAll ? "Syncing…" : "Sync All"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="gap-1.5"
          >
            <Download className="size-3.5" />
            Export Excel
          </Button>

          {canWrite && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onAddGroup}
                className="gap-1.5 whitespace-nowrap"
              >
                <Plus className="size-3.5" />
                Add Group
              </Button>
              <Button
                size="sm"
                onClick={onAddCamera}
                className="gap-1.5 whitespace-nowrap"
              >
                <PlusCircle className="size-3.5" />
                Add Camera
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Results hint ── */}
      {hasFilters && (
        <p className="text-xs text-muted-foreground -mt-2">
          Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
          {cameras.length} cameras
        </p>
      )}

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          {hasFilters ? "No cameras match your search." : "No cameras found. Add one to get started."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((cam, index) => (
              <TableRow key={cam.cameraId}>
                <TableCell className="font-mono text-xs text-muted-foreground">{index + 1}</TableCell>
                <TableCell className="font-medium">{cam.name}</TableCell>
                <TableCell>{cam.location}</TableCell>
                <TableCell>
                  {cam.group ? (
                    <Badge variant="outline" style={{ borderColor: cam.group.color, color: cam.group.color }}>
                      {cam.group.name}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{cam.ipAddress ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span>{cam.modelName ?? "—"}</span>
                    {syncResults[cam.cameraId] && (
                      <span className={`text-xs ${syncResults[cam.cameraId].ok ? "text-green-600" : "text-red-500"}`}>
                        {syncResults[cam.cameraId].msg}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={cam.status === "ACTIVE" ? "default" : "secondary"}>
                    {cam.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {cam.timestamp
                    ? new Date(cam.timestamp).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {cam.ipAddress && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSync(cam.cameraId)}
                        disabled={syncingId === cam.cameraId || syncingAll}
                      >
                        <RefreshCw className={`size-3.5 mr-1 ${syncingId === cam.cameraId ? "animate-spin" : ""}`} />
                        Sync
                      </Button>
                    )}
                    {canWrite && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => onEdit(cam)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onDelete(cam.cameraId)}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
