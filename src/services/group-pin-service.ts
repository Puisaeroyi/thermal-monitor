import { prisma } from "@/lib/prisma";

export async function listPins(groupId: string) {
  return prisma.cameraPin.findMany({
    where: { groupId },
    include: {
      camera: {
        select: { cameraId: true, name: true, status: true },
      },
    },
  });
}

export async function createPin(
  groupId: string,
  data: { cameraId: string; x: number; y: number }
) {
  return prisma.cameraPin.create({
    data: { groupId, cameraId: data.cameraId, x: data.x, y: data.y },
    include: {
      camera: {
        select: { cameraId: true, name: true, status: true },
      },
    },
  });
}

export async function deletePin(id: string) {
  return prisma.cameraPin.delete({ where: { id } });
}

export async function deleteAllPins(groupId: string) {
  return prisma.cameraPin.deleteMany({ where: { groupId } });
}

export async function updateGroupMapImage(groupId: string, path: string | null) {
  return prisma.group.update({
    where: { id: groupId },
    data: { mapImage: path },
  });
}
