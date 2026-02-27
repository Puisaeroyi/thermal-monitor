import { NextRequest, NextResponse } from "next/server";
import { ingestReadings, queryReadings } from "@/services/reading-service";
import { validateReadingBatch, ValidationError } from "@/lib/validate";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const readings = validateReadingBatch(body);
    const result = await ingestReadings(readings);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[POST /api/readings]", err);
    return NextResponse.json({ error: "Failed to ingest readings" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const cameraId = searchParams.get("cameraId") ?? undefined;
    const from = searchParams.get("from")
      ? new Date(searchParams.get("from")!)
      : undefined;
    const to = searchParams.get("to")
      ? new Date(searchParams.get("to")!)
      : undefined;
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : undefined;

    if (from && isNaN(from.getTime())) {
      return NextResponse.json({ error: "Invalid 'from' date" }, { status: 400 });
    }
    if (to && isNaN(to.getTime())) {
      return NextResponse.json({ error: "Invalid 'to' date" }, { status: 400 });
    }

    const readings = await queryReadings({ cameraId, from, to, limit });
    return NextResponse.json(readings);
  } catch (err) {
    console.error("[GET /api/readings]", err);
    return NextResponse.json({ error: "Failed to query readings" }, { status: 500 });
  }
}
