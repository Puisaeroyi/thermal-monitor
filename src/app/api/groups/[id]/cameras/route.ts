import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const cameras = await prisma.camera.findMany({
      where: { groupId: id },
      orderBy: { name: "asc" },
      select: { cameraId: true, name: true, location: true, status: true },
    });
    return NextResponse.json(cameras);
  } catch (err) {
    console.error("[GET /api/groups/[id]/cameras]", err);
    return NextResponse.json({ error: "Failed to fetch cameras" }, { status: 500 });
  }
}
