import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  validateTemperatureReadingBatch,
  ValidationError,
} from "@/lib/validate";
import type { TemperatureReadingInput } from "@/lib/validate";
import { evaluateReading } from "@/services/alert-evaluation-service";
import { publishReadings } from "@/lib/redis-pubsub";
import { getLatestReadings } from "@/services/reading-service";

/** Convert Fahrenheit to Celsius */
function fahrenheitToCelsius(f: number): number {
  return Math.round(((f - 32) * (5 / 9)) * 10) / 10;
}

/** Verify collector API secret for machine-to-machine auth */
function verifyCollectorSecret(req: NextRequest): boolean {
  const secret = req.headers.get("x-collector-secret");
  const expected = process.env.COLLECTOR_SECRET;
  // If no secret configured, allow (dev mode)
  if (!expected) return true;
  return secret === expected;
}

/**
 * POST /api/temperature-readings
 *
 * Accepts batch of readings from the Python RTSP collector script.
 * Requires x-collector-secret header when COLLECTOR_SECRET env is set.
 * - Resolves cameras by IP address (host field)
 * - Converts Fahrenheit → Celsius for storage
 * - NULL readings → mark camera INACTIVE
 * - Valid readings → mark camera ACTIVE
 * - Inserts readings into database
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check: verify collector secret
    if (!verifyCollectorSecret(req)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const readings = validateTemperatureReadingBatch(body);

    // Resolve cameras by IP address
    const uniqueHosts = [...new Set(readings.map((r) => r.host))];
    const cameras = await prisma.camera.findMany({
      where: { ipAddress: { in: uniqueHosts } },
      select: { cameraId: true, ipAddress: true, groupId: true },
    });
    const cameraByIp = new Map(
      cameras.map((c) => [c.ipAddress, c])
    );

    // Warn if multiple cameras share an IP (misconfiguration)
    if (cameras.length > uniqueHosts.length) {
      console.warn(
        "[temperature-readings] Multiple cameras share the same IP address"
      );
    }

    const readingsToInsert: Array<{
      cameraId: string;
      celsius: number;
      maxCelsius: number | null;
      minCelsius: number | null;
      timestamp: Date;
    }> = [];

    // Track which cameras go ACTIVE vs INACTIVE for bulk status update
    const activeCameraIds: string[] = [];
    const inactiveCameraIds: string[] = [];

    // Group readings by host to handle status updates
    const readingsByHost = new Map<string, TemperatureReadingInput[]>();
    for (const r of readings) {
      const existing = readingsByHost.get(r.host) ?? [];
      existing.push(r);
      readingsByHost.set(r.host, existing);
    }

    for (const [host, hostReadings] of readingsByHost) {
      const camera = cameraByIp.get(host);
      if (!camera) {
        console.warn(
          `[temperature-readings] No camera found for host ${host}`
        );
        continue;
      }

      // Determine if this camera has any valid reading in the batch
      const hasValidReading = hostReadings.some(
        (r) => r.max_temperature !== null
      );
      if (hasValidReading) {
        activeCameraIds.push(camera.cameraId);
      } else {
        inactiveCameraIds.push(camera.cameraId);
      }

      // Build reading rows
      for (const r of hostReadings) {
        const ts = new Date(r.ts_utc);

        // Reject future timestamps (clock drift protection)
        if (ts.getTime() > Date.now() + 5 * 60 * 1000) {
          console.warn(
            `[temperature-readings] Rejected future timestamp from ${host}`
          );
          continue;
        }

        if (r.max_temperature === null) {
          // Skip inserting NULL readings — no useful data to store
          // Camera status already tracked via INACTIVE above
          continue;
        }

        // Convert from Fahrenheit to Celsius for storage
        const isFahrenheit =
          r.unit?.toLowerCase() === "fahrenheit";
        const maxC = isFahrenheit
          ? fahrenheitToCelsius(r.max_temperature)
          : r.max_temperature;

        readingsToInsert.push({
          cameraId: camera.cameraId,
          celsius: maxC,
          maxCelsius: maxC,
          minCelsius: null,
          timestamp: ts,
        });
      }
    }

    // Bulk update camera statuses (2 queries instead of N)
    let statusUpdated = 0;
    if (activeCameraIds.length > 0) {
      const r = await prisma.camera.updateMany({
        where: { cameraId: { in: activeCameraIds }, status: { not: "ACTIVE" } },
        data: { status: "ACTIVE" },
      });
      statusUpdated += r.count;
    }
    if (inactiveCameraIds.length > 0) {
      const r = await prisma.camera.updateMany({
        where: { cameraId: { in: inactiveCameraIds }, status: { not: "INACTIVE" } },
        data: { status: "INACTIVE" },
      });
      statusUpdated += r.count;
    }

    // Bulk insert readings
    let inserted = 0;
    if (readingsToInsert.length > 0) {
      const result = await prisma.reading.createMany({
        data: readingsToInsert,
        skipDuplicates: false,
      });
      inserted = result.count;
    }

    // Evaluate alerts for valid readings (fire-and-forget)
    try {
      await Promise.all(
        readingsToInsert.map((r) => {
          const camera = cameras.find(
            (c) => c.cameraId === r.cameraId
          );
          return evaluateReading(
            r.cameraId,
            r.celsius,
            r.timestamp,
            camera?.groupId
          );
        })
      );
    } catch (err) {
      console.error(
        "[temperature-readings] Alert evaluation error:",
        err
      );
    }

    // Publish latest readings for SSE (fire-and-forget)
    try {
      const latest = await getLatestReadings();
      publishReadings(latest).catch(console.error);
    } catch (err) {
      console.error(
        "[temperature-readings] Publish error:",
        err
      );
    }

    return NextResponse.json(
      { inserted, updated_status: statusUpdated },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 400 }
      );
    }
    console.error("[POST /api/temperature-readings]", err);
    return NextResponse.json(
      { error: "Failed to process temperature readings" },
      { status: 500 }
    );
  }
}
