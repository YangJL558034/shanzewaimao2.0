import { createHash, randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanText, hasSafeFileSignature, safeUploadTypes, verifyCsrf } from "@/lib/security";
import { checkUploadAntivirus } from "@/lib/upload-antivirus";
import { optimizeImage, type OptimizedImage } from "@/lib/image-processing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiUser("media.write");
  if ("error" in auth) return auth.error;
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "安全令牌无效，请刷新页面后重试" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "请选择需要上传的文件" }, { status: 400 });

  const ext = path.extname(file.name).toLowerCase().replace(".jpeg", ".jpg");
  const expected = safeUploadTypes.get(file.type) || ({ "image/gif": ".gif", "image/avif": ".avif" } as Record<string, string>)[file.type];
  const isVideo = file.type.startsWith("video/");
  const maxMb = Number(isVideo ? process.env.MAX_VIDEO_UPLOAD_MB || 100 : process.env.MAX_UPLOAD_MB || 10);
  if (!expected || expected !== ext) return NextResponse.json({ error: "不支持此文件格式，视频仅支持 MP4、WebM" }, { status: 400 });
  if (file.size > maxMb * 1024 * 1024) return NextResponse.json({ error: `文件不能超过 ${maxMb}MB` }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const imageSignature = file.type === "image/gif" ? /^GIF8[79]a$/.test(buffer.subarray(0, 6).toString("ascii"))
    : file.type === "image/avif" ? buffer.subarray(4, 8).toString("ascii") === "ftyp" && /avif|avis/.test(buffer.subarray(8, 32).toString("ascii"))
    : hasSafeFileSignature(buffer, file.type);
  if (!imageSignature) return NextResponse.json({ error: "文件内容与扩展名不一致" }, { status: 400 });
  const antivirus = await checkUploadAntivirus(buffer, file.name, auth.user.id);
  if (!antivirus.allowed) return NextResponse.json({ error: antivirus.error }, { status: antivirus.status });

  let optimized: OptimizedImage | undefined;
  // A document's original-download field is not its display/preview image.
  // Preserve those bytes even if the source document happens to be a JPEG scan.
  if (file.type.startsWith("image/") && form.get("fileMode") !== "true") {
    try {
      optimized = await optimizeImage(buffer, {
        name: cleanText(form.get("name") || file.name, 200), alt: cleanText(form.get("alt"), 200),
        context: cleanText(form.get("context"), 200), folder: cleanText(form.get("folder") || "general", 50),
        preserveDetail: form.get("preserveDetail") === "true",
      });
    } catch {
      return NextResponse.json({ error: "图片无法处理：请上传有效的 JPG、PNG、WebP、GIF 或 AVIF 图片（不超过 5000 万像素、动画不超过 120 帧）。" }, { status: 422 });
    }
  }
  const name = optimized?.fileName || `${Date.now()}-${randomBytes(8).toString("hex")}${expected}`;
  const publicFolder = optimized ? "uploads/optimized" : "uploads";
  const dir = path.join(process.cwd(), "public", publicFolder);
  await mkdir(dir, { recursive: true });
  const writeOnce = async (fileName: string, data: Buffer) => {
    try { await writeFile(path.join(dir, fileName), data, { flag: "wx" }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !optimized) throw error; }
  };
  // Save every derivative before making the master URL visible to the CMS.
  for (const variant of optimized?.variants || []) await writeOnce(variant.fileName, variant.buffer);
  await writeOnce(name, optimized?.buffer || buffer);
  if (optimized) {
    const originals = path.join(process.cwd(), "storage", "private", "image-originals");
    await mkdir(originals, { recursive: true });
    const originalName = `${createHash("sha256").update(buffer).digest("hex")}${expected}`;
    try { await writeFile(path.join(originals, originalName), buffer, { flag: "wx" }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  }
  const media = await db.media.create({
    data: {
      name: cleanText(String(form.get("name") || file.name), 200),
      fileName: name,
      path: `/${publicFolder}/${name}`,
      mimeType: optimized?.mimeType || file.type,
      size: optimized?.buffer.length || file.size,
      width: optimized?.width,
      height: optimized?.height,
      alt: optimized?.alt || cleanText(form.get("alt"), 200),
      folder: cleanText(form.get("folder") || "general", 50),
    },
  });
  await db.auditLog.create({
    data: {
      userId: auth.user.id,
      action: "UPLOAD",
      entityType: "media",
      entityId: media.id,
      afterJson: JSON.stringify({ ...media, sha256: createHash("sha256").update(optimized?.buffer || buffer).digest("hex"), originalSha256: createHash("sha256").update(buffer).digest("hex"), originalBytes: file.size, responsiveWidths: optimized?.variants.map((item) => item.width), antivirus: { status: antivirus.result.status, engine: antivirus.result.engine } }),
    },
  });
  return NextResponse.json({ data: media, ...(optimized ? { optimization: { format: "webp", originalBytes: file.size, optimizedBytes: optimized.buffer.length, width: optimized.width, height: optimized.height, responsiveWidths: optimized.variants.map((item) => item.width) } } : {}), antivirus: { status: antivirus.result.status, engine: antivirus.result.engine } }, { status: 201 });
}
