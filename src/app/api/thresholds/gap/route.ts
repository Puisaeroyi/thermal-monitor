import { NextRequest, NextResponse } from "next/server";
import {
  listGapThresholds,
  createGapThreshold,
} from "@/services/threshold-service";
import { validateGapThresholdInput, ValidationError } from "@/lib/validate";

export async function GET() {
  try {
    const thresholds = await listGapThresholds();
    return NextResponse.json(thresholds);
  } catch (err) {
    console.error("[GET /api/thresholds/gap]", err);
    return NextResponse.json(
      { error: "Failed to list gap thresholds" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = validateGapThresholdInput(body);
    const threshold = await createGapThreshold(input);
    return NextResponse.json(threshold, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[POST /api/thresholds/gap]", err);
    return NextResponse.json(
      { error: "Failed to create gap threshold" },
      { status: 500 }
    );
  }
}
