import { prisma } from "@/lib/prisma";
import { GapDirection } from "@/generated/prisma/client";
import type {
  TemperatureThresholdInput,
  GapThresholdInput,
} from "@/lib/validate";
import { thresholdCache } from "@/services/threshold-cache";

// ─── Temperature Thresholds ───────────────────────────────────────────────────

export async function listTemperatureThresholds() {
  return prisma.temperatureThreshold.findMany({
    orderBy: { createdAt: "asc" },
  });
}

export async function getTemperatureThreshold(id: string) {
  return prisma.temperatureThreshold.findUnique({ where: { id } });
}

export async function createTemperatureThreshold(
  input: TemperatureThresholdInput
) {
  const result = await prisma.temperatureThreshold.create({
    data: {
      name: input.name,
      cameraId: input.cameraId ?? null,
      minCelsius: input.minCelsius ?? null,
      maxCelsius: input.maxCelsius ?? null,
      cooldownMinutes: input.cooldownMinutes ?? 5,
      notifyEmail: input.notifyEmail ?? false,
      enabled: input.enabled ?? true,
    },
  });
  thresholdCache.invalidate();
  return result;
}

export async function updateTemperatureThreshold(
  id: string,
  input: Partial<TemperatureThresholdInput>
) {
  const result = await prisma.temperatureThreshold.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.cameraId !== undefined && { cameraId: input.cameraId }),
      ...(input.minCelsius !== undefined && { minCelsius: input.minCelsius }),
      ...(input.maxCelsius !== undefined && { maxCelsius: input.maxCelsius }),
      ...(input.cooldownMinutes !== undefined && {
        cooldownMinutes: input.cooldownMinutes,
      }),
      ...(input.notifyEmail !== undefined && { notifyEmail: input.notifyEmail }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
    },
  });
  thresholdCache.invalidate();
  return result;
}

export async function deleteTemperatureThreshold(id: string) {
  const result = await prisma.temperatureThreshold.delete({ where: { id } });
  thresholdCache.invalidate();
  return result;
}

// ─── Gap Thresholds ───────────────────────────────────────────────────────────

export async function listGapThresholds() {
  return prisma.gapThreshold.findMany({
    orderBy: { createdAt: "asc" },
  });
}

export async function getGapThreshold(id: string) {
  return prisma.gapThreshold.findUnique({ where: { id } });
}

export async function createGapThreshold(input: GapThresholdInput) {
  const result = await prisma.gapThreshold.create({
    data: {
      name: input.name,
      cameraId: input.cameraId ?? null,
      intervalMinutes: input.intervalMinutes,
      maxGapCelsius: input.maxGapCelsius,
      direction: input.direction
        ? (input.direction as GapDirection)
        : GapDirection.BOTH,
      cooldownMinutes: input.cooldownMinutes ?? 5,
      notifyEmail: input.notifyEmail ?? false,
      enabled: input.enabled ?? true,
    },
  });
  thresholdCache.invalidate();
  return result;
}

export async function updateGapThreshold(
  id: string,
  input: Partial<GapThresholdInput>
) {
  const result = await prisma.gapThreshold.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.cameraId !== undefined && { cameraId: input.cameraId }),
      ...(input.intervalMinutes !== undefined && {
        intervalMinutes: input.intervalMinutes,
      }),
      ...(input.maxGapCelsius !== undefined && {
        maxGapCelsius: input.maxGapCelsius,
      }),
      ...(input.direction !== undefined && {
        direction: input.direction as GapDirection,
      }),
      ...(input.cooldownMinutes !== undefined && {
        cooldownMinutes: input.cooldownMinutes,
      }),
      ...(input.notifyEmail !== undefined && { notifyEmail: input.notifyEmail }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
    },
  });
  thresholdCache.invalidate();
  return result;
}

export async function deleteGapThreshold(id: string) {
  const result = await prisma.gapThreshold.delete({ where: { id } });
  thresholdCache.invalidate();
  return result;
}
