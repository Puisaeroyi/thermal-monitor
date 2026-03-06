import { NextResponse } from "next/server";
import { writeFile, mkdir, unlink, readdir } from "fs/promises";
import path from "path";
import { updateGroupMapImage, deleteAllPins } from "@/services/group-pin-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${id}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "maps");
    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);

    const imagePath = `/uploads/maps/${filename}`;
    await updateGroupMapImage(id, imagePath);

    return NextResponse.json({ mapImage: imagePath });
  } catch (err) {
    console.error("[POST /api/groups/[id]/map]", err);
    return NextResponse.json({ error: "Failed to upload map" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  try {
    // Remove map files matching this group id
    const uploadDir = path.join(process.cwd(), "public", "uploads", "maps");
    try {
      const files = await readdir(uploadDir);
      for (const file of files) {
        if (file.startsWith(`${id}.`)) {
          await unlink(path.join(uploadDir, file));
        }
      }
    } catch {
      // uploads dir may not exist yet
    }

    // Clear map image and all pins for this group
    await updateGroupMapImage(id, null);
    await deleteAllPins(id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/groups/[id]/map]", err);
    return NextResponse.json({ error: "Failed to delete map" }, { status: 500 });
  }
}
