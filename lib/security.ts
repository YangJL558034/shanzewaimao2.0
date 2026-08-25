import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cookieValue(request: Request, name: string) {
  return request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1] || "";
}

/**
 * CSRF tokens are deterministic for the current browser/session. React Strict
 * Mode can mount an effect twice and issue two parallel `/api/csrf` requests;
 * generating a new random cookie for every request makes the last response win
 * and leaves the UI holding a stale token. Binding the token to the session
 * (or the login browser's IP + user agent before a session exists) keeps all
 * concurrent requests in sync without storing server-side token state.
 */
export function csrfTokenForRequest(request: Request) {
  const session = cookieValue(request, "enercore_session");
  const browserBinding = session || `${getClientIp(request)}|${request.headers.get("user-agent") || "unknown"}`;
  const secret = process.env.CSRF_SECRET || process.env.AUTH_SECRET || process.env.APP_SECRET || "local-development-csrf-secret";
  return hashToken(`${secret}:${browserBinding}`);
}

/**
 * Reverse proxies normally terminate TLS before forwarding the request to
 * Next.js over HTTP. Cookie security must follow the visitor-facing protocol,
 * not NODE_ENV or the internal request URL.
 */
export function secureCookieForRequest(request: Request) {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwardedProto) return forwardedProto === "https";
  return new URL(request.url).protocol === "https:";
}

export function getClientIp(request: Request) {
  const platformForwarded = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  const cloudflare = request.headers.get("cf-connecting-ip")?.trim();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return platformForwarded || cloudflare || forwarded || request.headers.get("x-real-ip") || "unknown";
}

export function cleanText(value: unknown, max = 5000) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

export function sameToken(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

export async function verifyCsrf(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    let allowed = false;
    try {
      const originUrl = new URL(origin);
      const requestUrl = new URL(request.url);
      const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
      const host = forwardedHost || request.headers.get("host") || requestUrl.host;
      const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin : "";
      const fetchSite = request.headers.get("sec-fetch-site");
      allowed = fetchSite !== "cross-site" && (
        originUrl.host === host ||
        originUrl.host === requestUrl.host ||
        originUrl.origin === configuredOrigin
      );
    } catch {
      allowed = false;
    }
    const localProxyOrigin = origin === "http://localhost:3001" || origin === "http://127.0.0.1:3001";
    if (!allowed && !localProxyOrigin) return false;
  }
  const cookie = cookieValue(request, "enercore_csrf_v2");
  const header = request.headers.get("x-csrf-token");
  return sameToken(cookie ? decodeURIComponent(cookie) : null, header);
}

export async function checkRateLimit(key: string, limit = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 8), windowSeconds = Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60)) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000);
  try {
    const result = await db.$transaction(async (tx) => {
      const current = await tx.rateLimit.findUnique({ where: { key } });
      if (!current || current.expiresAt <= now) {
        return tx.rateLimit.upsert({
          where: { key },
          update: { count: 1, windowStart: now, expiresAt },
          create: { key, count: 1, windowStart: now, expiresAt },
        });
      }
      return tx.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    });
    return { allowed: result.count <= limit, remaining: Math.max(0, limit - result.count), retryAfter: Math.max(1, Math.ceil((result.expiresAt.getTime() - now.getTime()) / 1000)) };
  } catch {
    return { allowed: true, remaining: limit, retryAfter: windowSeconds };
  }
}

export const safeUploadTypes = new Map([
  ["application/pdf", ".pdf"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["video/mp4", ".mp4"],
  ["video/webm", ".webm"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
]);

export function hasSafeFileSignature(buffer: Buffer, mimeType: string) {
  if (buffer.length < 12) return false;
  const hex = buffer.subarray(0, 12).toString("hex");
  if (mimeType === "application/pdf") return buffer.subarray(0, 5).toString() === "%PDF-";
  if (mimeType === "image/jpeg") return hex.startsWith("ffd8ff");
  if (mimeType === "image/png") return hex.startsWith("89504e470d0a1a0a");
  if (mimeType === "image/webp") return buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  if (mimeType === "video/mp4") return buffer.subarray(4, 8).toString() === "ftyp";
  if (mimeType === "video/webm") return hex.startsWith("1a45dfa3");
  if (mimeType.includes("openxmlformats-officedocument")) return hex.startsWith("504b0304");
  return false;
}

export function contentDisposition(name: string) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(name.replace(/[\r\n"]/g, ""))}`;
}
