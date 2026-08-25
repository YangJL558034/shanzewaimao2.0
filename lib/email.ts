import nodemailer from "nodemailer";
import { EmailStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getSmtpConfig } from "@/lib/smtp-settings";

async function transporter() {
  const config = await getSmtpConfig();
  if (!config.host || !config.user || !config.password) return null;
  return { mailer: nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    pool: true,
  }), config };
}

export async function processEmailQueue(limit = 10) {
  const transport = await transporter();
  if (!transport) return { processed: 0, sent: 0, failed: 0, configured: false };
  const jobs = await db.emailQueue.findMany({
    where: { status: { in: [EmailStatus.PENDING, EmailStatus.FAILED] }, nextAttemptAt: { lte: new Date() }, attempts: { lt: 5 } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let sent = 0;
  let failed = 0;
  for (const job of jobs) {
    const locked = await db.emailQueue.updateMany({ where: { id: job.id, status: job.status }, data: { status: EmailStatus.SENDING, attempts: { increment: 1 } } });
    if (!locked.count) continue;
    try {
      await transport.mailer.sendMail({ from: transport.config.from, to: job.to, cc: job.cc || undefined, subject: job.subject, html: job.html, text: job.text || undefined });
      await db.emailQueue.update({ where: { id: job.id }, data: { status: EmailStatus.SENT, sentAt: new Date(), lastError: null } });
      sent++;
    } catch (error) {
      const attempts = job.attempts + 1;
      const nextAttemptAt = new Date(Date.now() + Math.min(3600, 30 * 2 ** attempts) * 1000);
      await db.emailQueue.update({ where: { id: job.id }, data: { status: EmailStatus.FAILED, nextAttemptAt, lastError: String(error).slice(0, 1000) } });
      failed++;
    }
  }
  return { processed: jobs.length, sent, failed, configured: true };
}

export function renderTemplate(template: string, data: Record<string, string>) {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_, key: string) => data[key] ?? "");
}
