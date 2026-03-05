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
  type?: AlertTypeFilter;
  acknowledged?: boolean;
  from?: Date;
  to?: Date;
  sort?: AlertTimestampSort;
  page?: number;
  limit?: number;
}

export type AlertTypeFilter =
  | "TEMPERATURE"
  | "GAP"
  | "MAX_TEMPERATURE"
  | "INCREASE_TEMPERATURE";

export type DisplayAlertType = "Max Temperature" | "Increase Temperature";
export type AlertTimestampSort = "asc" | "desc";

function mapTypeFilter(type?: AlertTypeFilter): AlertType | undefined {
  if (!type) return undefined;
  if (type === "TEMPERATURE" || type === "MAX_TEMPERATURE")
    return AlertType.TEMPERATURE;
  if (type === "GAP" || type === "INCREASE_TEMPERATURE")
    return AlertType.GAP;
  return undefined;
}

function mapDisplayType(type: AlertType): DisplayAlertType {
  return type === AlertType.TEMPERATURE
    ? "Max Temperature"
    : "Increase Temperature";
}

function formatCelsius(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : value.toFixed(1);
}

function extractGapIntervalMinutes(message: string): string | null {
  const slashFormat = message.match(/\/\s*(\d+)\s*m/i);
  if (slashFormat?.[1]) return slashFormat[1];

  const legacyFormat = message.match(/in\s*(\d+)\s*min/i);
  return legacyFormat?.[1] ?? null;
}

function buildShortMessage(alert: {
  type: AlertType;
  message: string;
  celsius: number;
  thresholdValue: number | null;
}): string {
  if (alert.type === AlertType.TEMPERATURE) {
    const isBelow = /\bbelow\b|\bmin\b/i.test(alert.message);
    const label = isBelow ? "Below min" : "Above max";
    const comparator = isBelow ? "<" : ">";
    return `${label}: ${formatCelsius(alert.celsius)}C ${comparator} ${formatCelsius(alert.thresholdValue)}C`;
  }

  const direction = /\bdrop|dropped\b/i.test(alert.message)
    ? "Drop"
    : /\brise|rose\b/i.test(alert.message)
    ? "Rise"
    : "Change";
  const interval = extractGapIntervalMinutes(alert.message);
  const intervalText = interval ? `/${interval}m` : "";
  return `${direction} > ${formatCelsius(alert.thresholdValue)}C${intervalText} (now ${formatCelsius(alert.celsius)}C)`;
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
  const mappedType = mapTypeFilter(params.type);
  const sort = params.sort === "asc" ? "asc" : "desc";

  const where = {
    ...(params.cameraId && { cameraId: params.cameraId }),
    ...(mappedType && { type: mappedType }),
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
      orderBy: { createdAt: sort },
      skip,
      take: limit,
      include: { camera: { select: { name: true } } },
    }),
    prisma.alert.count({ where }),
  ]);

  const enrichedAlerts = alerts.map((alert, index) => ({
    ...alert,
    eventId: skip + index + 1,
    displayType: mapDisplayType(alert.type),
    statusLabel: alert.acknowledged ? "Checked" : "Unchecked",
    shortMessage: buildShortMessage(alert),
  }));

  return {
    alerts: enrichedAlerts,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

export async function acknowledgeAlert(id: string, note?: string | null) {
  const existing = await prisma.alert.findUnique({
    where: { id },
    select: { acknowledgedAt: true },
  });

  if (!existing) {
    throw new Error("Record to update not found");
  }

  return prisma.alert.update({
    where: { id },
    data: {
      acknowledged: true,
      acknowledgedAt: existing.acknowledgedAt ?? new Date(),
      ...(note !== undefined ? { note } : {}),
    },
  });
}

export async function getUnacknowledgedCount() {
  const count = await prisma.alert.count({
    where: { acknowledged: false },
  });
  return { count };
}
