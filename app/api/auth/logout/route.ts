import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { hashToken, verifyCsrf } from "@/lib/security";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const csrfIsValid = await verifyCsrf(request);
  // The HttpOnly session cookie is SameSite=Strict. It is therefore also a
  // safe logout proof when browser/proxy layers omit Origin or Sec-Fetch-Site.
  if (!csrfIsValid && !isTrustedSameSiteRequest(request) && !token) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(0) });
  response.cookies.set("enercore_csrf_v2", "", { sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(0) });
  return response;
}

function isTrustedSameSiteRequest(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;
  if (!origin) return fetchSite === "same-origin" || fetchSite === "same-site";
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    if (source.hostname !== target.hostname) return false;
    if (process.env.NODE_ENV === "production" && source.protocol !== target.protocol) return false;
    return true;
  } catch {
    return false;
  }
}
