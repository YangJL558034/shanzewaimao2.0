import { isIP } from "node:net";

import { db } from "@/lib/db";

export type VisitGeo = {
  countryCode: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  source: "local" | "vercel" | "cloudflare" | "ipwhois" | "unknown";
};

function safeDecode(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value).trim().slice(0, 120) || null;
  } catch {
    return value.trim().slice(0, 120) || null;
  }
}

export function normalizeClientIp(value: string) {
  const candidate = value.trim().replace(/^\[|\]$/g, "");
  if (candidate.startsWith("::ffff:")) return candidate.slice(7);
  return candidate.slice(0, 64);
}

export function isPublicIp(value: string) {
  const ip = normalizeClientIp(value);
  const version = isIP(ip);
  if (!version) return false;
  if (version === 4) {
    const [a, b] = ip.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const lower = ip.toLowerCase();
  return !(
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe8") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb")
  );
}

function countryName(code: string | null) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(code.toUpperCase()) || code;
  } catch {
    return code;
  }
}

function geoFromHeaders(request: Request): VisitGeo | null {
  const vercelCountry = safeDecode(request.headers.get("x-vercel-ip-country"));
  const vercelRegion = safeDecode(request.headers.get("x-vercel-ip-country-region"));
  const vercelCity = safeDecode(request.headers.get("x-vercel-ip-city"));
  if (vercelCountry || vercelRegion || vercelCity) {
    const countryCode = vercelCountry?.toUpperCase() || null;
    return {
      countryCode,
      country: countryName(countryCode),
      region: vercelRegion,
      city: vercelCity,
      source: "vercel",
    };
  }

  const cfCountry = safeDecode(request.headers.get("cf-ipcountry"));
  const cfRegion = safeDecode(request.headers.get("cf-region"));
  const cfCity = safeDecode(request.headers.get("cf-ipcity"));
  if (cfCountry || cfRegion || cfCity) {
    const countryCode = cfCountry?.toUpperCase() || null;
    return {
      countryCode,
      country: countryName(countryCode),
      region: cfRegion,
      city: cfCity,
      source: "cloudflare",
    };
  }
  return null;
}

async function lookupPublicIp(ip: string): Promise<VisitGeo | null> {
  if (process.env.GEOIP_LOOKUP_ENABLED === "false") return null;
  try {
    const endpoint = `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,country_code,region,city&lang=zh-CN`;
    const response = await fetch(endpoint, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>;
    if (data.success !== true) return null;
    return {
      countryCode: typeof data.country_code === "string" ? data.country_code.slice(0, 3).toUpperCase() : null,
      country: typeof data.country === "string" ? data.country.slice(0, 120) : null,
      region: typeof data.region === "string" ? data.region.slice(0, 120) : null,
      city: typeof data.city === "string" ? data.city.slice(0, 120) : null,
      source: "ipwhois",
    };
  } catch {
    return null;
  }
}

export async function resolveVisitGeo(request: Request, ip: string, ipHash: string | null): Promise<VisitGeo> {
  const normalizedIp = normalizeClientIp(ip);
  if (!isPublicIp(normalizedIp)) {
    return {
      countryCode: null,
      country: "本地网络",
      region: null,
      city: "本地访问",
      source: "local",
    };
  }

  const headerGeo = geoFromHeaders(request);
  if (headerGeo?.city) return headerGeo;

  if (ipHash) {
    const cached = await db.geoIpCache.findUnique({ where: { ipHash } });
    if (cached && cached.expiresAt > new Date()) {
      return {
        countryCode: cached.countryCode,
        country: cached.country,
        region: cached.region,
        city: cached.city,
        source: cached.source as VisitGeo["source"],
      };
    }
  }

  const lookedUp = await lookupPublicIp(normalizedIp);
  const resolved = lookedUp || headerGeo || {
    countryCode: null,
    country: "未知地区",
    region: null,
    city: null,
    source: "unknown" as const,
  };

  if (ipHash) {
    await db.geoIpCache.upsert({
      where: { ipHash },
      create: {
        ipHash,
        countryCode: resolved.countryCode,
        country: resolved.country,
        region: resolved.region,
        city: resolved.city,
        source: resolved.source,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      update: {
        countryCode: resolved.countryCode,
        country: resolved.country,
        region: resolved.region,
        city: resolved.city,
        source: resolved.source,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }).catch(() => null);
  }
  return resolved;
}
