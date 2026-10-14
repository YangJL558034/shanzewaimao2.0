import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/security";
import { createFileBaseline } from "@/lib/security-center";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const auth = await requireApiUser("security.write"); if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "安全令牌无效，请刷新重试。" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (body?.confirm !== true) return NextResponse.json({ error: "请确认当前源码可信后再建立基线。" }, { status: 400 });
  try { return NextResponse.json({ ok: true, baseline: await createFileBaseline(auth.user.id) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "源码基线建立失败。" }, { status: 400 }); }
}
