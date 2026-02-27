import { prisma } from "@/lib/prisma";
import { CameraStatus } from "@/generated/prisma/client";
import type { CameraInput } from "@/lib/validate";

export async function listCameras() {
  return prisma.camera.findMany({
    orderBy: { cameraId: "asc" },
  });
}

export async function getCamera(cameraId: string) {
  const camera = await prisma.camera.findUnique({
    where: { cameraId },
  });
  return camera;
}

export async function createCamera(input: CameraInput) {
  return prisma.camera.create({
    data: {
      cameraId: input.cameraId,
      name: input.name,
      location: input.location,
      status: input.status ? (input.status as CameraStatus) : CameraStatus.ACTIVE,
    },
  });
}

export async function updateCamera(
  cameraId: string,
  input: Partial<CameraInput>
) {
  return prisma.camera.update({
    where: { cameraId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.status !== undefined && {
        status: input.status as CameraStatus,
      }),
    },
  });
}

export async function deleteCamera(cameraId: string) {
  return prisma.camera.delete({
    where: { cameraId },
  });
}
