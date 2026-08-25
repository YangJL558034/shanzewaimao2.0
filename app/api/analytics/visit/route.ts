import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { normalizeClientIp, resolveVisitGeo } from "@/lib/geoip";
import { checkRateLimit, cleanText, getClientIp } from "@/lib/security";
import { pruneOperationalLogs } from "@/lib/log-retention";

export const runtime = "nodejs";

const schema = z.object({
  visitorToken: z.string().uuid(),
  path: z.string().min(1).max(300).refine((value) => value.startsWith("/") && !value.startsWith("//")),
  referrer: z.string().max(1000).optional().default(""),
  locale: z.enum(["en", "zh"]).default("en"),
  device: z.enum(["desktop", "tablet", "mobile"]).default("desktop"),
});

function hash(value: string) {
  const secret = process.env.ANALYTICS_SECRET || process.env.AUTH_SECRET || "local-analytics-secret";
  return createHash("sha256").update(`${secret}:${value}`).digest("hex");
}

function sameSite(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const forwardedHost = request.headers.get("x-forwarded-host");
    const requestHost = forwardedHost || request.headers.get("host") || new URL(request.url).host;
    return originHost === requestHost || new URL(origin).hostname === new URL(request.url).hostname;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!sameSite(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success || input.data.path.startsWith("/admin") || input.data.path.startsWith("/api")) {
    return NextResponse.json({ error: "Invalid visit" }, { status: 400 });
  }
  const ip = normalizeClientIp(getClientIp(request));
  const ipHash = ip === "unknown" ? null : hash(ip);
  const limit = await checkRateLimit(`analytics:${hash(ip).slice(0, 24)}`, 240, 3600);
  if (!limit.allowed) return new NextResponse(null, { status: 204 });
  const geo = await resolveVisitGeo(request, ip, ipHash);
  await db.websiteVisit.create({
    data: {
      visitorHash: hash(input.data.visitorToken),
      path: cleanText(input.data.path, 300),
      referrer: cleanText(input.data.referrer, 1000) || null,
      locale: input.data.locale,
      device: input.data.device,
      ip: ip === "unknown" ? null : ip,
      ipHash,
      countryCode: geo.countryCode,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      geoSource: geo.source,
      userAgent: cleanText(request.headers.get("user-agent"), 500) || null,
    },
  });
  await pruneOperationalLogs();
  return new NextResponse(null, { status: 204, headers: { "cache-control": "no-store" } });
}
