import { NextResponse } from "next/server";
import { getLatestReadings } from "@/services/reading-service";

export async function GET() {
  try {
    const readings = await getLatestReadings();
    return NextResponse.json(readings);
  } catch (err) {
    console.error("[GET /api/readings/latest]", err);
    return NextResponse.json(
      { error: "Failed to get latest readings" },
      { status: 500 }
    );
  }
}
