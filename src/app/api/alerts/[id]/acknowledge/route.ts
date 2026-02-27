import { NextRequest, NextResponse } from "next/server";
import { acknowledgeAlert } from "@/services/alert-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const alert = await acknowledgeAlert(id);
    return NextResponse.json(alert);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Record to update not found")) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }
    console.error("[POST /api/alerts/[id]/acknowledge]", err);
    return NextResponse.json({ error: "Failed to acknowledge alert" }, { status: 500 });
  }
}
