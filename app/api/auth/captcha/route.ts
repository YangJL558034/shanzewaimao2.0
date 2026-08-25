import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { hashToken, randomToken } from "@/lib/security";

export async function GET() {
  const code = String(randomInt(1000, 10000));
  const nonce = randomToken(12);
  const expiresAt = Date.now() + 5 * 60_000;
  const secret = process.env.AUTH_SECRET || process.env.CSRF_SECRET || "local-development-captcha-secret";
  const payload = `${expiresAt}.${nonce}`;
  const signature = hashToken(`${secret}:login:${payload}:${code}`);
  const loginToken = `${payload}.${signature}`;
  return NextResponse.json(
    { code, loginToken, expiresAt },
    { headers: { "cache-control": "no-store, no-cache, must-revalidate" } },
  );
}
