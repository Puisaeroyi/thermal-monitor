import { NextRequest, NextResponse } from "next/server";
import {
  listTemperatureThresholds,
  createTemperatureThreshold,
} from "@/services/threshold-service";
import { validateTemperatureThresholdInput, ValidationError } from "@/lib/validate";

export async function GET() {
  try {
    const thresholds = await listTemperatureThresholds();
    return NextResponse.json(thresholds);
  } catch (err) {
    console.error("[GET /api/thresholds/temperature]", err);
    return NextResponse.json(
      { error: "Failed to list temperature thresholds" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = validateTemperatureThresholdInput(body);
    const threshold = await createTemperatureThreshold(input);
    return NextResponse.json(threshold, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[POST /api/thresholds/temperature]", err);
    return NextResponse.json(
      { error: "Failed to create temperature threshold" },
      { status: 500 }
    );
  }
}
