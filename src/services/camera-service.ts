import { prisma } from "@/lib/prisma";
import { CameraStatus } from "@/generated/prisma/client";
import type { CameraInput } from "@/lib/validate";
import { encryptPassword, decryptPassword, isEncrypted } from "@/lib/crypto-utils";

/**
 * Decrypt camera password if it's encrypted.
 * Internal helper for service layer.
 */
function decryptCameraPassword<T extends { password: string | null }>(
  camera: T
): T {
  if (camera.password) {
    return { ...camera, password: decryptPassword(camera.password) };
  }
  return camera;
}

export async function listCameras() {
  const cameras = await prisma.camera.findMany({
    orderBy: { cameraId: "asc" },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
    },
  });
  // Decrypt passwords on read
  return cameras.map(decryptCameraPassword);
}

export async function getCamera(cameraId: string) {
  const camera = await prisma.camera.findUnique({
    where: { cameraId },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
    },
  });
  return camera ? decryptCameraPassword(camera) : null;
}

export async function createCamera(input: CameraInput) {
  return prisma.camera.create({
    data: {
      cameraId: input.cameraId,
      name: input.name,
      location: input.location,
      status: input.status ? (input.status as CameraStatus) : CameraStatus.ACTIVE,
      ...(input.groupId ? { groupId: input.groupId } : {}),
      ipAddress: input.ipAddress || null,
      port: input.port ?? 80,
      username: input.username || null,
      // Encrypt password on write
      password: input.password ? encryptPassword(input.password) : null,
      modelName: input.modelName || null,
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
      ...(input.status !== undefined && { status: input.status as CameraStatus }),
      ...(input.groupId !== undefined && {
        group: input.groupId ? { connect: { id: input.groupId } } : { disconnect: true },
      }),
      ...(input.ipAddress !== undefined && { ipAddress: input.ipAddress }),
      ...(input.port !== undefined && { port: input.port }),
      ...(input.username !== undefined && { username: input.username }),
      // Encrypt password on update if provided
      ...(input.password !== undefined && {
        password: input.password ? encryptPassword(input.password) : undefined,
      }),
      ...(input.modelName !== undefined && { modelName: input.modelName }),
    },
  });
}

export async function deleteCamera(cameraId: string) {
  return prisma.camera.delete({
    where: { cameraId },
  });
}
