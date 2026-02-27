import { NextRequest, NextResponse } from "next/server";
import { getEmailConfig, updateEmailConfig } from "@/services/email-service";

export async function GET() {
  try {
    const config = getEmailConfig();
    // Never expose password in GET response
    const { password: _password, ...safeConfig } = config as Record<string, unknown>;
    return NextResponse.json(safeConfig);
  } catch (err) {
    console.error("[GET /api/settings/email]", err);
    return NextResponse.json(
      { error: "Failed to get email config" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = updateEmailConfig(body);
    const { password: _password, ...safeConfig } = updated as Record<string, unknown>;
    return NextResponse.json(safeConfig);
  } catch (err) {
    console.error("[PUT /api/settings/email]", err);
    return NextResponse.json(
      { error: "Failed to update email config" },
      { status: 500 }
    );
  }
}
