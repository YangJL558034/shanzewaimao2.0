import { randomInt } from "node:crypto";

import { db } from "@/lib/db";
import { getClientIp, hashToken, randomToken, sameToken } from "@/lib/security";

const challengeLifetimeMs = 5 * 60_000;

function bindingFor(request: Request) {
  const agent = request.headers.get("user-agent") || "unknown";
  return hashToken(`${getClientIp(request)}|${agent}`).slice(0, 20);
}

function signatureFor(payload: string) {
  const secret = process.env.CAPTCHA_SECRET || process.env.AUTH_SECRET || process.env.CSRF_SECRET || process.env.APP_SECRET || "local-newsletter-slide-secret";
  return hashToken(`${secret}:newsletter-slide:${payload}`);
}

export function createNewsletterChallenge(request: Request) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + challengeLifetimeMs;
  const target = randomInt(74, 92);
  const payload = `${issuedAt}.${expiresAt}.${randomToken(12)}.${target}.${bindingFor(request)}`;
  return {
    target,
    expiresAt,
    challengeToken: `${payload}.${signatureFor(payload)}`,
  };
}

export function verifyNewsletterChallenge(request: Request, token: string, position: number) {
  const [issuedRaw, expiresRaw, nonce, targetRaw, binding, signature] = token.split(".");
  const issuedAt = Number(issuedRaw);
  const expiresAt = Number(expiresRaw);
  const target = Number(targetRaw);
  if (!issuedAt || !expiresAt || !nonce || !binding || !signature || !Number.isFinite(target)) return false;
  const now = Date.now();
  if (issuedAt > now || now - issuedAt < 450 || expiresAt < now || expiresAt - issuedAt !== challengeLifetimeMs) return false;
  if (binding !== bindingFor(request) || Math.abs(position - target) > 3) return false;
  const payload = `${issuedRaw}.${expiresRaw}.${nonce}.${targetRaw}.${binding}`;
  return sameToken(signature, signatureFor(payload));
}

export async function consumeNewsletterChallenge(token: string, expiresAt: Date) {
  try {
    const now = new Date();
    const inserted = await db.$executeRaw`
      INSERT OR IGNORE INTO "RateLimit" ("id", "key", "count", "windowStart", "expiresAt")
      VALUES (${randomToken(12)}, ${`newsletter-slide:${hashToken(token).slice(0, 40)}`}, 1, ${now}, ${expiresAt})
    `;
    return inserted === 1;
  } catch {
    return false;
  }
}
