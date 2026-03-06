import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { ipAddress, port } = await req.json();

    if (!ipAddress || typeof ipAddress !== "string") {
      return NextResponse.json({ error: "ipAddress is required" }, { status: 400 });
    }

    const targetPort = Number(port) || 80;
    const protocol = targetPort === 443 ? "https" : "http";
    const url = `${protocol}://${ipAddress}:${targetPort}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        // @ts-expect-error Node fetch option to skip TLS verification for local cameras
        rejectUnauthorized: false,
      });
      clearTimeout(timeout);

      return NextResponse.json({
        success: res.status === 200,
        status: res.status,
      });
    } catch {
      clearTimeout(timeout);
      return NextResponse.json({
        success: false,
        error: "Connection failed or timed out",
      });
    }
  } catch (err) {
    console.error("[POST /api/cameras/test-connection]", err);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
