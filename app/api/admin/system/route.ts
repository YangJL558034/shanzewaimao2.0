import { NextResponse } from "next/server";
import { statfs } from "fs/promises";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth";
import { getSecurityOverview } from "@/lib/security-center";

export const runtime = "nodejs";
export async function GET() {
  const auth = await requireApiUser("security.read");
  if ("error" in auth) return auth.error;
  const started = Date.now();
  let database = "connected";
  try { await db.$queryRaw`SELECT 1`; } catch { database = "unavailable"; }
  const databaseLatencyMs = Date.now() - started;
  const [disk, security] = await Promise.all([statfs(process.cwd()).catch(() => null), getSecurityOverview()]);
  return NextResponse.json({ status: database === "connected" ? "healthy" : "degraded", database, databaseLatencyMs, node: process.version, environment: process.env.NODE_ENV, uptimeSeconds: Math.round(process.uptime()), memory: process.memoryUsage(), disk: disk ? { free: disk.bavail * disk.bsize, total: disk.blocks * disk.bsize } : null, timestamp: new Date().toISOString(), security, permissions: { canScan: auth.user.permissions.has("*") || auth.user.permissions.has("security.write"), canBaseline: auth.user.permissions.has("*") || auth.user.permissions.has("security.write") } }, { headers: { "cache-control": "no-store" } });
}
