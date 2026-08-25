import { NextResponse } from "next/server";

import { createNewsletterChallenge } from "@/lib/newsletter-challenge";
import { checkRateLimit, getClientIp } from "@/lib/security";

export async function GET(request: Request) {
  const rate = await checkRateLimit(`newsletter-challenge:${getClientIp(request)}`, 30, 3600);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many verification requests" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }
  return NextResponse.json(createNewsletterChallenge(request), {
    headers: { "cache-control": "no-store, no-cache, must-revalidate" },
  });
}
