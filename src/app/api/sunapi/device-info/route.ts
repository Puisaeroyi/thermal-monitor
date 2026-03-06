import { NextRequest, NextResponse } from "next/server";
import { getCamera, updateCamera } from "@/services/camera-service";

/** Parse key=value text response from SUNAPI */
function parseKeyValue(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/\r$/, "");
    if (key) result[key] = value;
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const { cameraId } = await req.json();

    if (!cameraId || typeof cameraId !== "string") {
      return NextResponse.json({ error: "cameraId is required" }, { status: 400 });
    }

    const camera = await getCamera(cameraId);
    if (!camera) {
      return NextResponse.json({ error: "Camera not found" }, { status: 404 });
    }
    if (!camera.ipAddress) {
      return NextResponse.json({ error: "Camera has no IP address configured" }, { status: 400 });
    }

    const ip = camera.ipAddress;
    const port = camera.port ?? 80;
    const username = camera.username || process.env.SUNAPI_USERNAME || "admin";
    const password = camera.password || process.env.SUNAPI_PASSWORD || "";

    // Build digest auth header via a two-step fetch
    const protocol = port === 443 ? "https" : "http";
    const url = `${protocol}://${ip}:${port}/stw-cgi/system.cgi?msubmenu=deviceinfo&action=view`;

    // First request to get WWW-Authenticate challenge
    const firstRes = await fetch(url, { signal: AbortSignal.timeout(5000) });

    let deviceText: string;

    if (firstRes.status === 401) {
      const wwwAuth = firstRes.headers.get("www-authenticate") ?? "";

      // Parse digest challenge
      const realm = wwwAuth.match(/realm="([^"]+)"/)?.[1] ?? "";
      const nonce = wwwAuth.match(/nonce="([^"]+)"/)?.[1] ?? "";
      const qop = wwwAuth.match(/qop="([^"]+)"/)?.[1] ?? "";

      const { createHash } = await import("crypto");
      const ha1 = createHash("md5").update(`${username}:${realm}:${password}`).digest("hex");
      const ha2 = createHash("md5").update(`GET:${new URL(url).pathname + new URL(url).search}`).digest("hex");
      const nc = "00000001";
      const cnonce = createHash("md5").update(Math.random().toString()).digest("hex").slice(0, 16);
      const responseHash = qop
        ? createHash("md5").update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest("hex")
        : createHash("md5").update(`${ha1}:${nonce}:${ha2}`).digest("hex");

      const authHeader = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${new URL(url).pathname + new URL(url).search}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${responseHash}"`;

      const secondRes = await fetch(url, {
        headers: { Authorization: authHeader },
        signal: AbortSignal.timeout(5000),
      });

      if (!secondRes.ok) {
        return NextResponse.json({ error: `Camera returned HTTP ${secondRes.status}` }, { status: 502 });
      }
      deviceText = await secondRes.text();
    } else if (firstRes.ok) {
      deviceText = await firstRes.text();
    } else {
      return NextResponse.json({ error: `Camera returned HTTP ${firstRes.status}` }, { status: 502 });
    }

    const info = parseKeyValue(deviceText);
    const model = info["Model"] ?? null;
    const firmwareVersion = info["FirmwareVersion"] ?? null;
    const serialNumber = info["SerialNumber"] ?? null;

    // Auto-update modelName in DB
    if (model) {
      await updateCamera(cameraId, { modelName: model });
    }

    return NextResponse.json({ model, firmwareVersion, serialNumber, raw: info });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const isTimeout = msg.includes("timeout") || msg.includes("abort") || msg.includes("ECONNREFUSED");
    console.error("[POST /api/sunapi/device-info]", err);
    return NextResponse.json(
      { error: isTimeout ? "Camera unreachable (timeout)" : `Failed to fetch device info: ${msg}` },
      { status: 502 }
    );
  }
}
