import { NextRequest, NextResponse } from "next/server";
import { listCameras, createCamera } from "@/services/camera-service";
import {
  validateCameraInput,
  ValidationError,
} from "@/lib/validate";

export async function GET() {
  try {
    const cameras = await listCameras();
    // Mask passwords in list response for security
    const maskedCameras = cameras.map(c => ({
      ...c,
      password: c.password ? "********" : null,
    }));
    return NextResponse.json(maskedCameras);
  } catch (err) {
    console.error("[GET /api/cameras]", err);
    return NextResponse.json({ error: "Failed to list cameras" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = validateCameraInput(body, true);
    const camera = await createCamera(input);
    return NextResponse.json(camera, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[POST /api/cameras]", err);
    return NextResponse.json({ error: "Failed to create camera" }, { status: 500 });
  }
}
