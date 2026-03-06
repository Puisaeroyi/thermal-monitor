import { prisma } from "@/lib/prisma";
import { DEFAULT_READINGS_LIMIT } from "@/lib/constants";
import type { ReadingInput } from "@/lib/validate";
import { evaluateReading } from "@/services/alert-evaluation-service";
import { publishReadings } from "@/lib/redis-pubsub";

export interface QueryReadingsParams {
  cameraId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface LatestReading {
  cameraId: string;
  name: string;
  location: string;
  status: "ACTIVE" | "INACTIVE";
  groupId: string | null;
  id: string;
  celsius: number;
  maxCelsius: number | null;
  minCelsius: number | null;
  timestamp: Date;
}

/** Bulk insert readings. Alert evaluation wired in Phase 6. */
export async function ingestReadings(readings: ReadingInput[]) {
  const data = readings.map((r) => ({
    cameraId: r.cameraId,
    celsius: r.celsius,
    ...(r.maxCelsius !== undefined && { maxCelsius: r.maxCelsius }),
    ...(r.minCelsius !== undefined && { minCelsius: r.minCelsius }),
    timestamp: new Date(r.timestamp),
  }));

  const result = await prisma.reading.createMany({
    data,
    skipDuplicates: false,
  });

  // Look up camera group memberships for scoped threshold evaluation
  let cameraGroupMap: Record<string, string | null> = {};
  try {
    const cameraIds = [...new Set(data.map((r) => r.cameraId))];
    const cameras = await prisma.camera.findMany({
      where: { cameraId: { in: cameraIds } },
      select: { cameraId: true, groupId: true },
    });
    cameraGroupMap = Object.fromEntries(
      cameras.map((c) => [c.cameraId, c.groupId])
    );
  } catch (err) {
    console.error("[reading-service] Camera group lookup error:", err);
  }

  // Evaluate each reading against thresholds — never fails ingestion
  try {
    await Promise.all(
      data.map((r) =>
        evaluateReading(r.cameraId, r.celsius, r.timestamp, cameraGroupMap[r.cameraId])
      )
    );
  } catch (err) {
    console.error("[reading-service] Alert evaluation error:", err);
  }

  // Publish latest readings to Redis for SSE distribution (fire-and-forget)
  try {
    const latest = await getLatestReadings();
    publishReadings(latest).catch((e) => {
      console.error("[reading-service] Publish readings error:", e);
    });
  } catch (err) {
    console.error("[reading-service] Get latest readings error:", err);
  }

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
    Array<{
      camera_id: string;
      name: string;
      location: string;
      status: "ACTIVE" | "INACTIVE";
      group_id: string | null;
      id: bigint;
      celsius: number;
      max_celsius: number | null;
      min_celsius: number | null;
      timestamp: Date;
    }>
  >`
    SELECT DISTINCT ON (c.camera_id)
      c.camera_id,
      c.name,
      c.location,
      c.status,
      c.group_id,
      r.id,
      r.celsius,
      r.max_celsius,
      r.min_celsius,
      r.timestamp
    FROM cameras c
    LEFT JOIN LATERAL (
      SELECT id, celsius, max_celsius, min_celsius, timestamp
      FROM readings
      WHERE camera_id = c.camera_id
      ORDER BY timestamp DESC
      LIMIT 1
    ) r ON true
    ORDER BY c.camera_id
  `;

  return rows.map((r) => ({
    cameraId: r.camera_id,
    name: r.name,
    location: r.location,
    status: r.status,
    groupId: r.group_id,
    id: r.id?.toString() ?? "",
    celsius: r.celsius,
    maxCelsius: r.max_celsius,
    minCelsius: r.min_celsius,
    timestamp: r.timestamp,
  }));
}
