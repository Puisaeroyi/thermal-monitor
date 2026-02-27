import { NextRequest, NextResponse } from "next/server";
import { listAlerts, getUnacknowledgedCount } from "@/services/alert-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    // Support ?count=unacknowledged as a shortcut
    if (searchParams.get("count") === "unacknowledged") {
      const result = await getUnacknowledgedCount();
      return NextResponse.json(result);
    }

    const cameraId = searchParams.get("cameraId") ?? undefined;
    const type = searchParams.get("type") as "TEMPERATURE" | "GAP" | null;
    const acknowledgedParam = searchParams.get("acknowledged");
    const acknowledged =
      acknowledgedParam === "true"
        ? true
        : acknowledgedParam === "false"
        ? false
        : undefined;
    const from = searchParams.get("from")
      ? new Date(searchParams.get("from")!)
      : undefined;
    const to = searchParams.get("to")
      ? new Date(searchParams.get("to")!)
      : undefined;
    const page = searchParams.get("page")
      ? parseInt(searchParams.get("page")!, 10)
      : undefined;
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : undefined;

    if (from && isNaN(from.getTime())) {
      return NextResponse.json({ error: "Invalid 'from' date" }, { status: 400 });
    }
    if (to && isNaN(to.getTime())) {
      return NextResponse.json({ error: "Invalid 'to' date" }, { status: 400 });
    }

    const result = await listAlerts({
      cameraId,
      type: type ?? undefined,
      acknowledged,
      from,
      to,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/alerts]", err);
    return NextResponse.json({ error: "Failed to list alerts" }, { status: 500 });
  }
}
