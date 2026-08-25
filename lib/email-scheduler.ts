import { processEmailQueue } from "@/lib/email";

declare global {
  var __enercoreEmailTimer: NodeJS.Timeout | undefined;
}

export function startEmailScheduler() {
  if (globalThis.__enercoreEmailTimer) return;
  const run = () => processEmailQueue(25).catch(() => undefined);
  globalThis.__enercoreEmailTimer = setInterval(run, 60_000);
  globalThis.__enercoreEmailTimer.unref();
  setTimeout(run, 5_000).unref();
}
