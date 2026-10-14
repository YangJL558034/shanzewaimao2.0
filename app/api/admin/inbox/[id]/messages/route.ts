import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/security";
import { recordOutboundMessage } from "@/lib/customer-center";

const schema = z.object({ content: z.string().trim().min(1).max(5000) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("inquiries.write");
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
  const payload = schema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ error: "Reply must contain 1–5000 characters." }, { status: 400 });
  try {
    const { id } = await params;
    const result = await recordOutboundMessage(id, auth.user.id, payload.data.content);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save reply." }, { status: 404 });
  }
}
