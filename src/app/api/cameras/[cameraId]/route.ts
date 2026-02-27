import { NextRequest, NextResponse } from "next/server";
import { getCamera, updateCamera, deleteCamera } from "@/services/camera-service";
import { validateCameraInput, ValidationError } from "@/lib/validate";

type Params = { params: Promise<{ cameraId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { cameraId } = await params;
    const camera = await getCamera(cameraId);
    if (!camera) {
      return NextResponse.json({ error: "Camera not found" }, { status: 404 });
    }
    return NextResponse.json(camera);
  } catch (err) {
    console.error("[GET /api/cameras/[cameraId]]", err);
    return NextResponse.json({ error: "Failed to get camera" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { cameraId } = await params;
    const body = await req.json();
    const input = validateCameraInput({ ...body, cameraId }, false);
    const camera = await updateCamera(cameraId, input);
    return NextResponse.json(camera);
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Record to update not found")) {
      return NextResponse.json({ error: "Camera not found" }, { status: 404 });
    }
    console.error("[PUT /api/cameras/[cameraId]]", err);
    return NextResponse.json({ error: "Failed to update camera" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { cameraId } = await params;
    await deleteCamera(cameraId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Record to delete does not exist")) {
      return NextResponse.json({ error: "Camera not found" }, { status: 404 });
    }
    console.error("[DELETE /api/cameras/[cameraId]]", err);
    return NextResponse.json({ error: "Failed to delete camera" }, { status: 500 });
  }
}
