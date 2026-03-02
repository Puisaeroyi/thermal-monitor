import { prisma } from "@/lib/prisma";
import { AlertType } from "@/generated/prisma/client";
import { ALERTS_PAGE_SIZE } from "@/lib/constants";
import { sendAlertEmail } from "@/services/email-service";
import { publishAlert } from "@/lib/redis-pubsub";

export interface CreateAlertInput {
  cameraId: string;
  type: "TEMPERATURE" | "GAP";
  message: string;
  celsius: number;
  thresholdValue?: number | null;
  notifyEmail?: boolean;
  thresholdId?: string;
}

export interface ListAlertsParams {
  cameraId?: string;
  type?: "TEMPERATURE" | "GAP";
  acknowledged?: boolean;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export async function createAlert(input: CreateAlertInput) {
  const alert = await prisma.alert.create({
    data: {
      cameraId: input.cameraId,
      type: input.type as AlertType,
      message: input.message,
      celsius: input.celsius,
      thresholdValue: input.thresholdValue ?? null,
    },
    include: { camera: { select: { name: true } } },
  });

  // Fire-and-forget email notification when threshold has notifyEmail enabled
  if (input.notifyEmail) {
    sendAlertEmail({
      cameraId: input.cameraId,
      cameraName: alert.camera?.name ?? input.cameraId,
      type: input.type,
      message: input.message,
      celsius: input.celsius,
      thresholdValue: input.thresholdValue,
      triggeredAt: alert.createdAt,
    }).catch((err) =>
      console.error("[alert-service] Email dispatch failed:", err)
    );
  }

  // Publish alert to Redis for SSE distribution (fire-and-forget)
  publishAlert(alert).catch((err) =>
    console.error("[alert-service] Publish alert error:", err)
  );

  return alert;
}

export async function listAlerts(params: ListAlertsParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(params.limit ?? ALERTS_PAGE_SIZE, 100);
  const skip = (page - 1) * limit;

  const where = {
    ...(params.cameraId && { cameraId: params.cameraId }),
    ...(params.type && { type: params.type as AlertType }),
    ...(params.acknowledged !== undefined && {
      acknowledged: params.acknowledged,
    }),
    ...(params.from || params.to
      ? {
          createdAt: {
            ...(params.from && { gte: params.from }),
            ...(params.to && { lte: params.to }),
          },
        }
      : {}),
  };

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { camera: { select: { name: true } } },
    }),
    prisma.alert.count({ where }),
  ]);

  return {
    alerts,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

export async function acknowledgeAlert(id: string) {
  return prisma.alert.update({
    where: { id },
    data: {
      acknowledged: true,
      acknowledgedAt: new Date(),
    },
  });
}

export async function getUnacknowledgedCount() {
  const count = await prisma.alert.count({
    where: { acknowledged: false },
  });
  return { count };
}
