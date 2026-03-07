import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;
        const cameraIds = searchParams.get("cameraIds")?.split(",").filter(Boolean) ?? [];
        const fromDate = searchParams.get("from"); // e.g. "2026-03-07"
        const toDate = searchParams.get("to");     // e.g. "2026-03-08"
        const tz = searchParams.get("tz") || "America/New_York"; // Target installation timezone

        if (!fromDate || !toDate) {
            return NextResponse.json({ error: "Missing date range" }, { status: 400 });
        }

        if (cameraIds.length === 0) {
            return NextResponse.json({});
        }

        /**
         * We use PostgreSQL's 'AT TIME ZONE' to convert UTC timestamps to the target timezone (US)
         * before filtering. This ensures that '2026-03-07' correctly matches Mar 7 in NY local time,
         * regardless of whether the developer is in Vietnam, US, or elsewhere.
         */
        const rows = await prisma.$queryRaw<
            Array<{
                camera_id: string;
                avg_temp: number | null;
                min_temp: number | null;
                max_temp: number | null;
                count: bigint;
            }>
        >`
            SELECT
                camera_id,
                AVG(COALESCE(avg_celsius, celsius))::float   AS avg_temp,
                MIN(COALESCE(min_celsius, celsius))::float   AS min_temp,
                MAX(COALESCE(max_celsius, celsius))::float   AS max_temp,
                COUNT(*)                                     AS count
            FROM readings
            WHERE camera_id = ANY(${cameraIds})
              AND (timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${tz})::date >= ${fromDate}::date
              AND (timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${tz})::date <= ${toDate}::date
            GROUP BY camera_id
        `;

        const result: Record<string, { avg: number | null; min: number | null; max: number | null; count: number }> =
            {};

        for (const row of rows) {
            result[row.camera_id] = {
                avg: row.avg_temp != null ? Math.round(row.avg_temp * 10) / 10 : null,
                min: row.min_temp != null ? Math.round(row.min_temp * 10) / 10 : null,
                max: row.max_temp != null ? Math.round(row.max_temp * 10) / 10 : null,
                count: Number(row.count),
            };
        }

        return NextResponse.json(result);
    } catch (err) {
        console.error("[GET /api/readings/stats]", err);
        return NextResponse.json({ error: "Failed to fetch reading stats" }, { status: 500 });
    }
}
