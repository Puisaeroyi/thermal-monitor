import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, routeParams: RouteParams) {
  const { id } = await routeParams.params;
  try {
    const body = await request.json();
    const { name, color } = body;

    const group = await prisma.group.update({
      where: { id },
      data: { name, color },
    });

    return NextResponse.json(group);
  } catch (err) {
    console.error("[PUT /api/groups/[id]]", err);
    return NextResponse.json({ error: "Failed to update group" }, { status: 500 });
  }
}

export async function DELETE(request: Request, routeParams: RouteParams) {
  const { id } = await routeParams.params;
  try {
    // Set groupId to null for cameras in this group
    await prisma.camera.updateMany({
      where: { groupId: id },
      data: { groupId: null },
    });

    await prisma.group.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/groups/[id]]", err);
    return NextResponse.json({ error: "Failed to delete group" }, { status: 500 });
  }
}
