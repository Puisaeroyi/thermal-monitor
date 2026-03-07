import { NextResponse } from "next/server";
import { listPins, createPin } from "@/services/group-pin-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const pins = await listPins(id);
    return NextResponse.json(pins);
  } catch (err) {
    console.error("[GET /api/groups/[id]/pins]", err);
    return NextResponse.json({ error: "Failed to fetch pins" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { cameraId, x, y } = body;

    if (!cameraId || x == null || y == null) {
      return NextResponse.json({ error: "cameraId, x, y required" }, { status: 400 });
    }
    if (x < 0 || x > 100 || y < 0 || y > 100) {
      return NextResponse.json({ error: "x, y must be 0-100" }, { status: 400 });
    }

    const pin = await createPin(id, { cameraId, x, y });
    return NextResponse.json(pin, { status: 201 });
  } catch (err) {
    console.error("[POST /api/groups/[id]/pins]", err);
    return NextResponse.json({ error: "Failed to create pin" }, { status: 500 });
  }
}
