import { NextResponse } from "next/server";
import { csrfTokenForRequest, secureCookieForRequest } from "@/lib/security";

export async function GET(request: Request) {
  const token = csrfTokenForRequest(request);
  const response = NextResponse.json({ token }, { headers: { "cache-control": "no-store, no-cache, must-revalidate" } });
  response.cookies.set("enercore_csrf_v2", token, { httpOnly: false, sameSite: "lax", secure: secureCookieForRequest(request), path: "/", maxAge: 3600 });
  response.cookies.set("csrf_token", "", { path: "/", maxAge: 0 });
  return response;
}
