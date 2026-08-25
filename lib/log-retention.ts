import "server-only";

import { db } from "@/lib/db";

const RETENTION_JOB_KEY = "maintenance:operational-log-retention";
const JOB_INTERVAL_MS = 24 * 60 * 60 * 1000;

let activeCleanup: Promise<{ visits: number; audits: number } | null> | null = null;

/**
 * Keeps only the latest three calendar months of visitor and operation logs.
 * The database-backed maintenance gate makes this safe to call from normal
 * requests while limiting the actual cleanup work to once per day.
 */
export async function pruneOperationalLogs() {
  if (activeCleanup) return activeCleanup;

  activeCleanup = (async () => {
    const now = new Date();
    const gate = await db.rateLimit.findUnique({ where: { key: RETENTION_JOB_KEY } });
    if (gate?.expiresAt && gate.expiresAt > now) return null;

    const nextRun = new Date(now.getTime() + JOB_INTERVAL_MS);
    await db.rateLimit.upsert({
      where: { key: RETENTION_JOB_KEY },
      create: {
        key: RETENTION_JOB_KEY,
        count: 1,
        windowStart: now,
        expiresAt: nextRun,
      },
      update: {
        count: 1,
        windowStart: now,
        expiresAt: nextRun,
      },
    });

    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - 3);

    const [visits, audits] = await db.$transaction([
      db.websiteVisit.deleteMany({ where: { createdAt: { lt: cutoff } } }),
      db.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    ]);

    return { visits: visits.count, audits: audits.count };
  })().finally(() => {
    activeCleanup = null;
  });

  return activeCleanup;
}
