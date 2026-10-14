import { after, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { checkRateLimit, verifyCsrf } from "@/lib/security";
import { createSecurityScan, getSecurityScan, listSecurityScans, runSecurityScan } from "@/lib/security-center";

export const runtime = "nodejs";
export const maxDuration = 180;
const schema = z.object({ scope: z.enum(["all", "uploads", "source"]).default("all") });

export async function GET(request: Request) {
  const auth = await requireApiUser("security.read"); if ("error" in auth) return auth.error;
  const id = new URL(request.url).searchParams.get("id");
  const data = id ? await getSecurityScan(id) : await listSecurityScans();
  if (id && !data) return NextResponse.json({ error: "检测记录不存在。" }, { status: 404 });
  return NextResponse.json({ data }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireApiUser("security.write"); if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "安全令牌无效，请刷新重试。" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "请选择网站文件、上传文件或源码检测。" }, { status: 400 });
  const rate = await checkRateLimit(`security-scan:${auth.user.id}`, 10, 3600);
  if (!rate.allowed) return NextResponse.json({ error: "检测过于频繁，请稍后再试。" }, { status: 429 });
  try {
    const scan = await createSecurityScan(parsed.data.scope, auth.user.id);
    after(async () => { await runSecurityScan(scan, auth.user.id); });
    return NextResponse.json({ data: scan }, { status: 202 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "检测任务创建失败。" }, { status: 409 }); }
}
