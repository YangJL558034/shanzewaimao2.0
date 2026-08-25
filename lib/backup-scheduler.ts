import { runScheduledBackupIfDue } from "@/lib/backup";

declare global {
  var __enercoreBackupScheduler: ReturnType<typeof setInterval> | undefined;
}

export function startBackupScheduler() {
  if (globalThis.__enercoreBackupScheduler) return;
  const check = () =>
    runScheduledBackupIfDue().catch((error) =>
      console.error("[automatic-backup]", error),
    );
  const initial = setTimeout(check, 15_000);
  initial.unref?.();
  globalThis.__enercoreBackupScheduler = setInterval(check, 10 * 60_000);
  globalThis.__enercoreBackupScheduler.unref?.();
}
