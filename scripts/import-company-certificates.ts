import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { companyCertificates, companyCertificationSection } from "../lib/company-certificates";
import { inferCertificateCategory } from "../lib/certificate-categories";

loadEnvConfig(process.cwd());
const db = new PrismaClient();
const apply = process.argv.includes("--apply");
async function main() {
  for (const document of companyCertificates) await readFile(path.resolve("public", document.image.slice(1)));
  const [certificates, translations, section, zh, media] = await Promise.all([
    db.certificate.findMany(),
    db.translation.findMany({ where: { entityType: { in: ["Certificate", "PageSection"] } } }),
    db.pageSection.findUnique({ where: { page_key: { page: "quality", key: "certifications" } } }),
    db.locale.findUniqueOrThrow({ where: { code: "zh" } }),
    db.media.findMany({ where: { path: { in: companyCertificates.map((document) => document.image) } } }),
  ]);
  const targets = companyCertificates.map((document) => ({ document, existing: certificates.find((row) => row.image === document.image || row.name === document.name) || certificates.find((row) => "legacyName" in document && row.name === document.legacyName && !row.image && !row.fileUrl) }));
  console.log(JSON.stringify({ mode: apply ? "apply" : "preview", documents: companyCertificates.map((item) => ({ name: item.name, image: item.image })), sourcePages: [19, 20], isoExpiry: "2026-10-08", labelCorrection: "ISO 9001 blue / ISO 45001 red, following certificate body", thirdPartyVerification: false, preserved: ["CE/FCC/UN38.3 original rows", "CRM", "other page sections", "custom certificate originals"] }, null, 2));
  if (!apply) return;
  const changedIds = new Set(targets.flatMap((item) => item.existing ? [item.existing.id] : []));
  if (section) changedIds.add(section.id);
  await mkdir("outputs/certificate-backups", { recursive: true });
  await writeFile(`outputs/certificate-backups/before-import-${Date.now()}.json`, JSON.stringify({ certificates: certificates.filter((row) => changedIds.has(row.id)), translations: translations.filter((row) => changedIds.has(row.entityId)), section, media }, null, 2), { flag: "wx" });
  await db.$transaction(async (tx) => {
    const translate = async (entityType: string, entityId: string, field: string, value: string) => tx.translation.upsert({ where: { localeId_entityType_entityId_field: { localeId: zh.id, entityType, entityId, field } }, create: { localeId: zh.id, entityType, entityId, field, value }, update: { value } });
    for (const { document, existing } of targets) {
      if (existing?.image && existing.image !== document.image) continue;
      const data = { name: document.name, issuer: document.issuer, certificateNo: document.certificateNo, image: document.image, fileUrl: existing?.fileUrl || document.image, expiresAt: document.expiresAt ? new Date(document.expiresAt) : null, sortOrder: document.sortOrder, isVisible: existing?.isVisible ?? true };
      let id: string;
      if (existing) {
        const update = await tx.certificate.updateMany({ where: { id: existing.id, updatedAt: existing.updatedAt }, data });
        if (update.count !== 1) throw new Error(`Certificate changed during import: ${document.name}`);
        id = existing.id;
      } else id = (await tx.certificate.create({ data: { ...data, category: inferCertificateCategory(document.name) } })).id;
      await translate("Certificate", id, "name", document.zh.name);
      await translate("Certificate", id, "issuer", document.zh.issuer);
      if (!media.some((row) => row.path === document.image)) {
        const bytes = await readFile(path.resolve("public", document.image.slice(1)));
        await tx.media.create({ data: { name: document.name, fileName: path.basename(document.image), path: document.image, mimeType: document.image.endsWith(".png") ? "image/png" : "image/jpeg", size: bytes.length, width: document.width, height: document.height, alt: document.name, folder: "company-certificates", isPrivate: false } });
      }
    }
    if (section) {
      const updated = await tx.pageSection.updateMany({ where: { id: section.id, updatedAt: section.updatedAt }, data: companyCertificationSection.en });
      if (updated.count !== 1) throw new Error("Certification section changed during import.");
      for (const [field, value] of Object.entries(companyCertificationSection.zh)) await translate("PageSection", section.id, field, value);
    }
  }, { timeout: 30000 });
  console.log("Imported 6 source document/marking images into certificates and the media library. Other records unchanged.");
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => db.$disconnect());
