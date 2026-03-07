import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/readings/history?cameraIds=&from=&to=&tz=
 * 
 * Returns raw reading rows for selected cameras within the date range,
 * converted into the target timezone for date filtering.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const cameraIds = searchParams.get("cameraIds")?.split(",").filter(Boolean) ?? [];
        const fromDate = searchParams.get("from"); // e.g. "2026-03-07"
        const toDate = searchParams.get("to");     // e.g. "2026-03-08"
        const tz = searchParams.get("tz") || "America/New_York";

        if (!fromDate || !toDate) {
            return NextResponse.json({ error: "Missing date range" }, { status: 400 });
        }

        if (cameraIds.length === 0) {
            return NextResponse.json([]);
        }

        /**
         * Fetch raw readings for those cameras in that local day range.
         * We convert to the target timezone for filtering.
         */
        const readings = await prisma.$queryRaw<
            Array<{
                camera_id: string;
                avg_temp: number | null;
                min_temp: number | null;
                max_temp: number | null;
                local_timestamp: Date;
            }>
        >`
            SELECT
                camera_id,
                celsius                                      AS avg_temp,
                COALESCE(min_celsius, celsius)              AS min_temp,
                COALESCE(max_celsius, celsius)              AS max_temp,
                (timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${tz}) AS local_timestamp
            FROM readings
            WHERE camera_id = ANY(${cameraIds})
              AND (timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${tz})::date >= ${fromDate}::date
              AND (timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${tz})::date <= ${toDate}::date
            ORDER BY timestamp ASC
            LIMIT 100000;
        `;

        // Format BigInt / Dates for JSON response
        const result = readings.map((r) => ({
            cameraId: r.camera_id,
            avg: r.avg_temp != null ? Math.round(r.avg_temp * 10) / 10 : null,
            min: r.min_temp != null ? Math.round(r.min_temp * 10) / 10 : null,
            max: r.max_temp != null ? Math.round(r.max_temp * 10) / 10 : null,
            timestamp: r.local_timestamp,
        }));

        return NextResponse.json(result);
    } catch (err) {
        console.error("[GET /api/readings/history]", err);
        return NextResponse.json({ error: "Failed to fetch reading history" }, { status: 500 });
    }
}
