import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { companyAboutBanner, companyAboutDocument, companyProfileSections, companyProfileSettings, companyProfileSource } from "../lib/company-profile";

loadEnvConfig(process.cwd());
const db = new PrismaClient();
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const sourceIndex = args.indexOf("--source");
const sourcePath = sourceIndex >= 0 ? args[sourceIndex + 1] : undefined;
const fields = ["title", "subtitle", "content", "items"] as const;
const unsupportedMetrics: Record<string, string> = { factory_area: "20,000+ m²", monthly_output: "1,000,000+ pcs", export_countries: "100+" };
const demoPartners = new Set(["NovaTech", "BluePeak", "Synex", "Orbitron", "LumiCore", "VastLink"]);

async function main() {
  if (apply && !sourcePath) throw new Error("Use --source with the verified company-profile PDF before applying.");
  const sourceHash = sourcePath ? createHash("sha256").update(await readFile(path.resolve(sourcePath))).digest("hex") : undefined;
  const [sections, translations, settings, zhLocale, banners, aboutPage] = await Promise.all([
    db.pageSection.findMany({ where: { page: { in: ["home", "about", "factory"] } } }),
    db.translation.findMany({ where: { entityType: { in: ["PageSection", "Page", "Banner"] } } }),
    db.setting.findMany({ where: { key: { in: Object.keys(companyProfileSettings) } } }),
    db.locale.findUnique({ where: { code: "zh" } }),
    db.banner.findMany({ where: { page: { in: ["home", "about", "factory"] } } }),
    db.page.findUnique({ where: { slug: "about" } }),
  ]);
  if (!zhLocale) throw new Error("Chinese locale must exist to preserve bilingual CMS editing.");
  const patches = companyProfileSections.filter((profile) => {
    if (profile.key !== "partners") return true;
    const existing = sections.find((row) => row.page === profile.page && row.key === profile.key);
    if (!existing) return true;
    try {
      const items = JSON.parse(existing.items) as { title?: string }[];
      return existing.image === profile.en.image || items.length === 0 || (items.length === demoPartners.size && items.every((item) => demoPartners.has(item.title || "")));
    } catch { return false; }
  });
  const selectedSettings = Object.entries(companyProfileSettings).filter(([key, value]) => {
    if (value !== "" || !unsupportedMetrics[key]) return true;
    const row = settings.find((item) => item.key === key);
    return !row || row.value === "" || row.value === unsupportedMetrics[key];
  });
  const selectedSections = sections.filter((row) => patches.some((profile) => profile.page === row.page && profile.key === row.key));
  const ids = new Set([...selectedSections.map((row) => row.id), ...banners.map((row) => row.id), ...(aboutPage ? [aboutPage.id] : [])]);
  console.log(JSON.stringify({ mode: apply ? "apply" : "preview", source: companyProfileSource.title, sourceHash, sections: patches.map((profile) => `${profile.page}:${profile.key}`), sourcePages: Object.fromEntries(patches.map((profile) => [`${profile.page}:${profile.key}`, profile.sourcePages])), history: [1999, 2003, 2014, 2022], preserved: ["products", "WhatsApp and other channel settings", "contacts", "CRM", "users", "audit history", "custom partner lists", "custom non-placeholder production metrics"] }, null, 2));
  if (!apply) return;
  await mkdir("outputs/company-profile-backups", { recursive: true });
  const backupPath = path.resolve("outputs/company-profile-backups", `before-import-${Date.now()}.json`);
  await writeFile(backupPath, JSON.stringify({ source: companyProfileSource, sourceHash, sections: selectedSections, translations: translations.filter((row) => ids.has(row.entityId)), settings, banners, aboutPage }, null, 2), { flag: "wx" });
  await db.$transaction(async (tx) => {
    const translate = async (entityType: string, entityId: string, copy: Record<string, unknown>) => {
      for (const [field, value] of Object.entries(copy)) {
        const text = field === "items" ? JSON.stringify(value) : String(value);
        await tx.translation.upsert({ where: { localeId_entityType_entityId_field: { localeId: zhLocale.id, entityType, entityId, field } }, create: { localeId: zhLocale.id, entityType, entityId, field, value: text }, update: { value: text } });
      }
    };
    for (const profile of patches) {
      const before = selectedSections.find((row) => row.page === profile.page && row.key === profile.key);
      const data = { title: profile.en.title, subtitle: profile.en.subtitle, content: profile.en.content, items: JSON.stringify(profile.en.items), ...(profile.en.image !== undefined ? { image: profile.en.image } : {}) };
      let id: string;
      if (before) {
        const result = await tx.pageSection.updateMany({ where: { id: before.id, updatedAt: before.updatedAt }, data });
        if (result.count !== 1) throw new Error(`Section changed during import: ${profile.page}:${profile.key}. Retry after checking the CMS.`);
        id = before.id;
      } else {
        const row = await tx.pageSection.create({ data: { page: profile.page, key: profile.key, ...data, isVisible: true, sortOrder: profile.key === "stats" ? 2 : 1 } }); id = row.id;
      }
      await translate("PageSection", id, Object.fromEntries(fields.map((field) => [field, profile.zh[field]])));
    }
    for (const [key, value] of selectedSettings) {
      const before = settings.find((row) => row.key === key);
      if (before) {
        const result = await tx.setting.updateMany({ where: { id: before.id, value: before.value, updatedAt: before.updatedAt }, data: { value } });
        if (result.count !== 1) throw new Error(`Setting changed during import: ${key}`);
      } else await tx.setting.create({ data: { key, value, group: "company", type: "text", isPublic: true } });
    }
    for (const banner of banners) {
      if (banner.page !== "about" && !banner.image?.startsWith("/references/")) continue;
      const result = await tx.banner.updateMany({ where: { id: banner.id, updatedAt: banner.updatedAt }, data: banner.page === "about" ? companyAboutBanner.en : { image: "/company-profile/manufacturing-collage.jpg" } });
      if (result.count !== 1) throw new Error("About banner changed during import.");
      if (banner.page === "about") await translate("Banner", banner.id, companyAboutBanner.zh);
    }
    if (aboutPage) {
      const result = await tx.page.updateMany({ where: { id: aboutPage.id, updatedAt: aboutPage.updatedAt }, data: companyAboutDocument.en });
      if (result.count !== 1) throw new Error("About document changed during import.");
      await translate("Page", aboutPage.id, companyAboutDocument.zh);
    }
  }, { timeout: 30000 });
  console.log(`Company profile imported. Backup: ${backupPath}`);
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => db.$disconnect());
