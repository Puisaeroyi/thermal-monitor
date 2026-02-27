import { NextRequest, NextResponse } from "next/server";
import {
  updateGapThreshold,
  deleteGapThreshold,
} from "@/services/threshold-service";
import { validateGapThresholdInput, ValidationError } from "@/lib/validate";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const input = validateGapThresholdInput(body);
    const threshold = await updateGapThreshold(id, input);
    return NextResponse.json(threshold);
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Record to update not found")) {
      return NextResponse.json({ error: "Threshold not found" }, { status: 404 });
    }
    console.error("[PUT /api/thresholds/gap/[id]]", err);
    return NextResponse.json(
      { error: "Failed to update gap threshold" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await deleteGapThreshold(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Record to delete does not exist")) {
      return NextResponse.json({ error: "Threshold not found" }, { status: 404 });
    }
    console.error("[DELETE /api/thresholds/gap/[id]]", err);
    return NextResponse.json(
      { error: "Failed to delete gap threshold" },
      { status: 500 }
    );
  }
}
