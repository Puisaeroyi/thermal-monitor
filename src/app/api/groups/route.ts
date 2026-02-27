import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const groups = await prisma.group.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { cameras: true } },
      },
    });

    return NextResponse.json(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color,
        cameraCount: g._count.cameras,
      }))
    );
  } catch (err) {
    console.error("[GET /api/groups]", err);
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, color } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const group = await prisma.group.create({
      data: {
        name,
        id: name.toLowerCase().replace(/\s+/g, "-"),
        color: color || "#6b7280",
      },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (err) {
    console.error("[POST /api/groups]", err);
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}
