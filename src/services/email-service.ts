import nodemailer from "nodemailer";

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  to: string;
}

export interface AlertEmailPayload {
  cameraId: string;
  cameraName: string;
  type: string;
  message: string;
  celsius: number;
  thresholdValue?: number | null;
  triggeredAt: Date;
}

/** Read SMTP config from environment variables. */
export function getEmailConfig(): Partial<EmailConfig> {
  return {
    host: process.env.SMTP_HOST ?? "",
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER ?? "",
    password: process.env.SMTP_PASSWORD ?? "",
    from: process.env.SMTP_FROM ?? "",
    to: process.env.SMTP_TO ?? "",
  };
}

/** Validate whether SMTP is configured. */
function isSmtpConfigured(cfg: Partial<EmailConfig>): cfg is EmailConfig {
  return Boolean(cfg.host && cfg.user && cfg.from && cfg.to);
}

/** Update email config by writing back to process.env (runtime only). */
export function updateEmailConfig(updates: Partial<EmailConfig>): Partial<EmailConfig> {
  if (updates.host !== undefined) process.env.SMTP_HOST = updates.host;
  if (updates.port !== undefined)
    process.env.SMTP_PORT = String(updates.port);
  if (updates.secure !== undefined)
    process.env.SMTP_SECURE = String(updates.secure);
  if (updates.user !== undefined) process.env.SMTP_USER = updates.user;
  if (updates.password !== undefined)
    process.env.SMTP_PASSWORD = updates.password;
  if (updates.from !== undefined) process.env.SMTP_FROM = updates.from;
  if (updates.to !== undefined) process.env.SMTP_TO = updates.to;

  return getEmailConfig();
}

/** Send an alert email. Fails gracefully if SMTP is not configured. */
export async function sendAlertEmail(
  payload: AlertEmailPayload
): Promise<{ sent: boolean; reason?: string }> {
  const cfg = getEmailConfig();

  if (!isSmtpConfigured(cfg)) {
    return { sent: false, reason: "SMTP not configured" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.password },
    });

    const subject = `[Thermal Alert] ${payload.type} — ${payload.cameraName}`;
    const body = [
      `Alert Type: ${payload.type}`,
      `Camera: ${payload.cameraName} (${payload.cameraId})`,
      `Message: ${payload.message}`,
      `Temperature: ${payload.celsius.toFixed(2)} °C`,
      payload.thresholdValue != null
        ? `Threshold: ${payload.thresholdValue} °C`
        : null,
      `Triggered At: ${payload.triggeredAt.toISOString()}`,
    ]
      .filter(Boolean)
      .join("\n");

    await transporter.sendMail({
      from: cfg.from,
      to: cfg.to,
      subject,
      text: body,
    });

    return { sent: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown SMTP error";
    console.error("[email-service] Failed to send alert email:", reason);
    return { sent: false, reason };
  }
}
