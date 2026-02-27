import { prisma } from "@/lib/prisma";
import { DEFAULT_READINGS_LIMIT } from "@/lib/constants";
import type { ReadingInput } from "@/lib/validate";

export interface QueryReadingsParams {
  cameraId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface LatestReading {
  cameraId: string;
  id: string;
  celsius: number;
  timestamp: Date;
}

/** Bulk insert readings. Alert evaluation wired in Phase 6. */
export async function ingestReadings(readings: ReadingInput[]) {
  const data = readings.map((r) => ({
    cameraId: r.cameraId,
    celsius: r.celsius,
    timestamp: new Date(r.timestamp),
  }));

  const result = await prisma.reading.createMany({
    data,
    skipDuplicates: false,
  });

  return { inserted: result.count };
}

/** Query readings with optional filters. Returns newest-first. */
export async function queryReadings(params: QueryReadingsParams) {
  const limit = Math.min(params.limit ?? DEFAULT_READINGS_LIMIT, DEFAULT_READINGS_LIMIT);

  const readings = await prisma.reading.findMany({
    where: {
      ...(params.cameraId && { cameraId: params.cameraId }),
      ...(params.from || params.to
        ? {
            timestamp: {
              ...(params.from && { gte: params.from }),
              ...(params.to && { lte: params.to }),
            },
          }
        : {}),
    },
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  // Serialize BigInt id to string
  return readings.map((r) => ({ ...r, id: r.id.toString() }));
}

/** Get the most recent reading per camera using raw SQL for efficiency. */
export async function getLatestReadings(): Promise<LatestReading[]> {
  const rows = await prisma.$queryRaw<
    Array<{ camera_id: string; id: bigint; celsius: number; timestamp: Date }>
  >`
    SELECT DISTINCT ON (camera_id)
      camera_id,
      id,
      celsius,
      timestamp
    FROM readings
    ORDER BY camera_id, timestamp DESC
  `;

  return rows.map((r) => ({
    cameraId: r.camera_id,
    id: r.id.toString(),
    celsius: r.celsius,
    timestamp: r.timestamp,
  }));
}
