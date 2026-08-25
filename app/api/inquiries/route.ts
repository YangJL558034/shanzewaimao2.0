import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { checkRateLimit, cleanText, getClientIp, hasSafeFileSignature, safeUploadTypes, verifyCsrf } from "@/lib/security";
import { processEmailQueue, renderTemplate } from "@/lib/email";
import { getSmtpConfig } from "@/lib/smtp-settings";

export const runtime = "nodejs";

const schema = z.object({
  fullName: z.string().min(2).max(100), companyName: z.string().min(2).max(150), email: z.string().email().max(254), phone: z.string().max(50).optional(), country: z.string().min(2).max(100), productInterest: z.string().min(2).max(150), message: z.string().min(20).max(5000), consent: z.literal("yes"), website: z.string().max(0).optional(),
});

function escapeHtml(value: string) { return value.replace(/[&<>'"]/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]!)); }

export async function POST(request: Request) {
  if (!(await verifyCsrf(request))) return NextResponse.json({ error: "The secure form token has expired. Please refresh and try again." }, { status: 403 });
  const ip = getClientIp(request);
  const rate = await checkRateLimit(`inquiry:${ip}`, 5, 3600);
  if (!rate.allowed) return NextResponse.json({ error: "Too many inquiries from this connection. Please try again later." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  const form = await request.formData();
  const raw = Object.fromEntries([...form.entries()].filter(([,v])=>typeof v === "string"));
  if (raw.website) return NextResponse.json({ ok: true, referenceNo: "RECEIVED" });
  const parsed = schema.safeParse(Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,cleanText(v,k==="message"?5000:254)])));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Please check the required fields." }, { status: 400 });
  const files = form.getAll("files").filter((file): file is File => file instanceof File && file.size > 0);
  const maxBytes = Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024;
  if (files.length > 5) return NextResponse.json({ error: "A maximum of 5 attachments is allowed." }, { status: 400 });
  for (const file of files) {
    const extension = path.extname(file.name).toLowerCase();
    if (file.size > maxBytes || !safeUploadTypes.has(file.type) || safeUploadTypes.get(file.type) !== extension.replace(".jpeg",".jpg")) return NextResponse.json({ error: `File ${file.name} is not an allowed type or exceeds the size limit.` }, { status: 400 });
  }
  const preparedFiles=[] as {file:File;buffer:Buffer}[];
  for(const file of files){const buffer=Buffer.from(await file.arrayBuffer());if(!hasSafeFileSignature(buffer,file.type))return NextResponse.json({error:`File ${file.name} did not pass content verification.`},{status:400});preparedFiles.push({file,buffer});}
  const referenceNo = `ENQ-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const data = parsed.data;
  const inquiry = await db.inquiry.create({ data: { referenceNo, fullName: data.fullName, companyName: data.companyName, email: data.email.toLowerCase(), phone: data.phone, country: data.country, productInterest: data.productInterest, message: data.message, ip, userAgent: request.headers.get("user-agent")?.slice(0,500), consentAt: new Date() } });
  if (preparedFiles.length) {
    const directory = path.join(process.cwd(), "storage", "private", inquiry.id);
    await mkdir(directory, { recursive: true });
    for (const {file,buffer} of preparedFiles) {
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      const safeName = `${randomBytes(12).toString("hex")}${safeUploadTypes.get(file.type)}`;
      const filePath = path.join(directory, safeName);
      await writeFile(filePath, buffer, { flag: "wx" });
      await db.inquiryAttachment.create({ data: { inquiryId: inquiry.id, fileName: cleanText(file.name,200), path: filePath, mimeType: file.type, size: file.size, sha256 } });
    }
  }
  const template = await db.emailTemplate.findUnique({ where: { key: "new_inquiry" } });
  const vars = { referenceNo, fullName: escapeHtml(data.fullName), companyName: escapeHtml(data.companyName), email: escapeHtml(data.email), phone: escapeHtml(data.phone||"—"), country: escapeHtml(data.country), productInterest: escapeHtml(data.productInterest), message: escapeHtml(data.message).replaceAll("\n","<br>") };
  const subject = renderTemplate(template?.subject || "New website inquiry {{referenceNo}} — {{companyName}}", vars);
  const html = renderTemplate(template?.html || "<h2>New B2B Inquiry {{referenceNo}}</h2><p><strong>Company:</strong> {{companyName}}</p><p><strong>Contact:</strong> {{fullName}} · {{email}} · {{phone}}</p><p><strong>Country:</strong> {{country}}</p><p><strong>Interest:</strong> {{productInterest}}</p><p>{{message}}</p>", vars);
  const smtp = await getSmtpConfig();
  await db.emailQueue.create({ data: { templateKey: "new_inquiry", to: smtp.notifyTo, subject, html, payloadJson: JSON.stringify({ inquiryId: inquiry.id, referenceNo }) } });
  processEmailQueue(2).catch(()=>undefined);
  return NextResponse.json({ ok: true, referenceNo }, { status: 201 });
}
