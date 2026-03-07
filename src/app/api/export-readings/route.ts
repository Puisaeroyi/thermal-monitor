import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/export-readings?from=&to=&cameraId=
 *
 * Export temperature readings as CSV with date range filter.
 * Returns CSV file download with headers.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const cameraId = searchParams.get("cameraId") ?? undefined;
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");

    const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 86400000); // default: last 24h
    const to = toStr ? new Date(toStr) : new Date();

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    const readings = await prisma.reading.findMany({
      where: {
        ...(cameraId && { cameraId }),
        timestamp: { gte: from, lte: to },
      },
      include: { camera: { select: { name: true, location: true } } },
      orderBy: { timestamp: "asc" },
      take: 100000, // safety limit
    });

    // Escape CSV cell to prevent formula injection (=, +, -, @)
    function safeCsvCell(value: string): string {
      const s = String(value).replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(s)) return `"'${s}"`;
      if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s}"`;
      return s;
    }

    // Build CSV
    const csvHeader = "Camera ID,Camera Name,Location,Timestamp,Celsius,Max Celsius,Min Celsius,Avg Celsius";
    const csvRows = readings.map((r) => {
      const ts = r.timestamp.toISOString();
      const name = safeCsvCell(r.camera.name);
      const location = safeCsvCell(r.camera.location);
      return `${safeCsvCell(r.cameraId)},${name},${location},${ts},${r.celsius},${r.maxCelsius ?? ""},${r.minCelsius ?? ""},${r.avgCelsius ?? ""}`;
    });

    const csv = [csvHeader, ...csvRows].join("\n");
    const filename = `readings-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/export-readings]", err);
    return NextResponse.json({ error: "Failed to export readings" }, { status: 500 });
  }
}
