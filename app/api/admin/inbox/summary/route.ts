import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getInboxSummary } from "@/lib/support-analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiUser("inquiries.read");
  if ("error" in auth) return auth.error;
  return NextResponse.json({ data: await getInboxSummary() }, { headers: { "Cache-Control": "private, no-store" } });
}
