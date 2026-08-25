import { createHash, randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanText, hasSafeFileSignature, safeUploadTypes, verifyCsrf } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiUser("media.write");
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "安全令牌无效，请刷新页面后重试" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "请选择需要上传的文件" }, { status: 400 });

  const ext = path.extname(file.name).toLowerCase().replace(".jpeg", ".jpg");
  const expected = safeUploadTypes.get(file.type);
  const isVideo = file.type.startsWith("video/");
  const maxMb = Number(isVideo ? process.env.MAX_VIDEO_UPLOAD_MB || 100 : process.env.MAX_UPLOAD_MB || 10);
  if (!expected || expected !== ext) return NextResponse.json({ error: "不支持此文件格式，视频仅支持 MP4、WebM" }, { status: 400 });
  if (file.size > maxMb * 1024 * 1024) return NextResponse.json({ error: `文件不能超过 ${maxMb}MB` }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!hasSafeFileSignature(buffer, file.type)) return NextResponse.json({ error: "文件内容与扩展名不一致" }, { status: 400 });

  const name = `${Date.now()}-${randomBytes(8).toString("hex")}${expected}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buffer, { flag: "wx" });
  const media = await db.media.create({
    data: {
      name: cleanText(String(form.get("name") || file.name), 200),
      fileName: name,
      path: `/uploads/${name}`,
      mimeType: file.type,
      size: file.size,
      alt: cleanText(form.get("alt"), 200),
      folder: cleanText(form.get("folder") || "general", 50),
    },
  });
  await db.auditLog.create({
    data: {
      userId: auth.user.id,
      action: "UPLOAD",
      entityType: "media",
      entityId: media.id,
      afterJson: JSON.stringify({ ...media, sha256: createHash("sha256").update(buffer).digest("hex") }),
    },
  });
  return NextResponse.json({ data: media }, { status: 201 });
}
