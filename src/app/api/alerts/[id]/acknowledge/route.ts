import { NextRequest, NextResponse } from "next/server";
import { acknowledgeAlert } from "@/services/alert-service";

type Params = { params: { id: string } | Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const id = typeof resolvedParams?.id === "string" ? resolvedParams.id : "";
    if (!id) {
      return NextResponse.json({ error: "Missing alert id" }, { status: 400 });
    }

    let note: string | null | undefined = undefined;

    try {
      const body = await req.json();
      if (body && typeof body === "object" && "note" in body) {
        const value = (body as { note?: unknown }).note;
        if (value !== null && value !== undefined && typeof value !== "string") {
          return NextResponse.json({ error: "Invalid 'note' value" }, { status: 400 });
        }
        note = typeof value === "string" ? value.trim() : value ?? null;
      }
    } catch {
      // Backward compatibility: allow empty body for old clients.
    }

    const alert = await acknowledgeAlert(id, note);
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
