import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getSupportAnalytics } from "@/lib/support-analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiUser("inquiries.read");
  if ("error" in auth) return auth.error;
  return NextResponse.json({ data: await getSupportAnalytics() }, { headers: { "Cache-Control": "private, no-store" } });
}
