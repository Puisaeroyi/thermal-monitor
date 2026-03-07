import { NextResponse } from "next/server";
import { deletePin } from "@/services/group-pin-service";

interface RouteParams {
  params: Promise<{ id: string; pinId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { pinId } = await params;
  try {
    await deletePin(pinId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/groups/[id]/pins/[pinId]]", err);
    return NextResponse.json({ error: "Failed to delete pin" }, { status: 500 });
  }
}
