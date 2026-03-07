"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Settings, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InteractiveMap } from "@/components/groups/interactive-map";
import { MapUploadButton } from "@/components/groups/map-upload-button";
import { useUserRole, isWriteRole } from "@/hooks/use-user-role";

interface GroupInfo {
  id: string;
  name: string;
  color: string;
  mapImage: string | null;
  cameraCount: number;
}

interface Camera {
  cameraId: string;
  name: string;
  location: string;
  status: "ACTIVE" | "INACTIVE";
}

interface Pin {
  id: string;
  cameraId: string;
  x: number;
  y: number;
  camera: { cameraId: string; name: string; status: "ACTIVE" | "INACTIVE" };
}

export default function ZonePage() {
  const role = useUserRole();
  const canWrite = isWriteRole(role);
  const { zoneId } = useParams<{ zoneId: string }>();
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [groupsRes, camerasRes, pinsRes] = await Promise.all([
          fetch("/api/groups"),
          fetch(`/api/groups/${zoneId}/cameras`),
          fetch(`/api/groups/${zoneId}/pins`),
        ]);
        const groups: GroupInfo[] = groupsRes.ok ? await groupsRes.json() : [];
        const cams: Camera[] = camerasRes.ok ? await camerasRes.json() : [];
        const pinData: Pin[] = pinsRes.ok ? await pinsRes.json() : [];
        setGroup(groups.find((g) => g.id === zoneId) ?? null);
        setCameras(cams);
        setPins(pinData);
      } catch {
        // silent
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [zoneId]);

  const zoneName = group?.name ?? zoneId;

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <h1 className="text-2xl font-bold">{isLoading ? "Loading…" : zoneName}</h1>
        <Link href="/settings">
          <Button variant="ghost" size="icon" title="Settings">
            <Settings className="size-4" />
          </Button>
        </Link>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6 flex-1 min-h-0">
        {/* Left: Camera List */}
        <Card className="flex flex-col w-72 shrink-0">
          <CardHeader className="pb-3 shrink-0">
            <CardTitle className="text-base">
              Camera List
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({cameras.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex flex-col gap-2 p-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : cameras.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No cameras in this zone.
              </p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {cameras.map((cam, index) => (
                  <Link key={cam.cameraId} href={`/cameras/${cam.cameraId}`}>
                    <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                      <span className="text-xs text-muted-foreground w-4 shrink-0">{index + 1}</span>
                      <Circle
                        className={`size-1.5 shrink-0 fill-current ${cam.status === "ACTIVE" ? "text-green-500" : "text-gray-400"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{cam.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{cam.location}</p>
                      </div>
                      <span className={`text-xs shrink-0 ${cam.status === "ACTIVE" ? "text-green-500" : "text-gray-400"}`}>
                        {cam.status === "ACTIVE" ? "Connected" : "Disconnected"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Interactive Map */}
        <Card className="flex flex-col flex-1 min-w-0">
          <CardHeader className="pb-3 shrink-0 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Map View</CardTitle>
            {group && canWrite && (
              <MapUploadButton
                groupId={zoneId}
                hasMap={!!group.mapImage}
                onUploaded={(path) =>
                  setGroup((prev) => (prev ? { ...prev, mapImage: path } : prev))
                }
                onDeleted={() => {
                  setGroup((prev) => (prev ? { ...prev, mapImage: null } : prev));
                  setPins([]);
                }}
              />
            )}
          </CardHeader>
          <CardContent className="flex-1 relative p-2 min-h-0">
            <InteractiveMap
              groupId={zoneId}
              mapImage={group?.mapImage ?? null}
              pins={pins}
              cameras={cameras}
              onPinsChange={setPins}
              readOnly={!canWrite}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
