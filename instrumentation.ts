export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackupScheduler } = await import("@/lib/backup-scheduler");
    const { startEmailScheduler } = await import("@/lib/email-scheduler");
    startBackupScheduler();
    startEmailScheduler();
  }
}
