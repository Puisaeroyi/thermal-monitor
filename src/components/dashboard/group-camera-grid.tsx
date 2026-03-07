"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CameraCard } from "./camera-card";
import type { TempUnit } from "@/contexts/temp-unit-context";

interface Props {
  groups: any[];
  cameras: any[];
  thresholds: any;
  unit: TempUnit;
}

export function GroupCameraGrid({
  groups,
  cameras,
  thresholds,
  unit,
}: Props) {

  const router = useRouter();
  const ZONES_PER_PAGE = 3;

  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(groups.length / ZONES_PER_PAGE);

  const start = (page - 1) * ZONES_PER_PAGE;
  const visibleGroups = groups.slice(start, start + ZONES_PER_PAGE);

  return (
    <div className="space-y-6">

      {/* ZONE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {visibleGroups.map((group: any) => {

          const groupCameras = cameras.filter(
            (c: any) => c.groupId === group.id
          );

          return (
            <div
              key={group.id}
              className="border rounded-xl p-4 space-y-4 bg-background"
            >

              {/* ZONE TITLE — click to view group detail */}
              <h2
                className="text-lg font-semibold cursor-pointer hover:underline"
                onClick={() => router.push(`/groups/${group.id}`)}
              >
                {group.name}
              </h2>

              {/* CAMERA GRID */}
              <div className="space-y-3">

                {groupCameras.map((camera: any) => (
                  <CameraCard
                    key={camera.cameraId}
                    camera={camera}
                    thresholds={thresholds}
                    unit={unit}
                  />
                ))}

              </div>

            </div>
          );
        })}

      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">

          <button
            className="px-3 py-1 border rounded disabled:opacity-40"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Prev
          </button>

          <span className="px-3 py-1 text-sm">
            Page {page} / {totalPages}
          </span>

          <button
            className="px-3 py-1 border rounded disabled:opacity-40"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>

        </div>
      )}

    </div>
  );
}