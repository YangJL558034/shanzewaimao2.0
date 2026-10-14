import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Public CMS branding migration. Default is read-only:
 *   npx tsx scripts/rename-shanze-brand.ts
 *   npx tsx scripts/rename-shanze-brand.ts --apply
 *
 * The allowlist excludes customer/CRM records, credentials, users, sessions,
 * audits, email queue/templates, asset files, identifiers and URL fields.
 */
const db = new PrismaClient();
const argumentsSet = new Set(process.argv.slice(2));
const apply = argumentsSet.has("--apply");
if (argumentsSet.has("--apply") && argumentsSet.has("--dry-run")) throw new Error("Choose either --apply or --dry-run.");
for (const argument of argumentsSet) if (!["--apply", "--dry-run"].includes(argument)) throw new Error(`Unknown option: ${argument}`);

const chineseBrand = "山泽新能源科技";
const englishBrand = "Shanze New Energy Technology";
const oldBrand = /能核科技|核能科技|能核|\benercore\b/i;
const protectedKey = /(?:^|[_-])(?:id|key|slug|sku|url|href|path|src|email|phone|tel|address|token|secret|password|credential|file|filename|mime|canonical|icon|avatar|logo|image|certificateNo)(?:$|[_-])|(?:Id|Url|Href|Path|Image|Email|Phone|Secret|Token|Password|Key)$/;

// Protect URL, email and path fragments even when embedded in visible copy or Markdown.
const protectedFragments = /((?:https?:\/\/|mailto:|tel:)[^\s<>"']+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?::\d+)?(?:\/[^\s<>"')]+)?|(?:[A-Za-z]:[\\/]|\/)[^\s<>"'()]+)/g;

function renameText(value: string) {
  if (!oldBrand.test(value)) return value;
  return value.split(protectedFragments).map((fragment, index) => index % 2 ? fragment : fragment
    .replace(/(?:能核|核能)(?:新能源)?科技|能核/g, chineseBrand)
    .replace(/\benercore(?:\s+new\s+energy\s+technology)?\b/gi, englishBrand)
  ).join("");
}

function renameJsonValue(value: unknown): unknown {
  if (typeof value === "string") return renameText(value);
  if (Array.isArray(value)) return value.map(renameJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, protectedKey.test(key) || key.startsWith("@") ? child : renameJsonValue(child)]));
  }
  return value;
}

type Scope = { model: string; entityType: string; fields: string[]; jsonFields?: string[]; where?: Record<string, unknown> };
const publicCompanyKeys = ["company_name", "company_name_zh", "company_description", "company_description_zh", "site_name", "site_name_zh"];
const scopes: Scope[] = [
  { model: "setting", entityType: "Setting", fields: ["value"], where: { OR: [{ isPublic: true }, { key: { in: publicCompanyKeys } }] } },
  { model: "navigationItem", entityType: "NavigationItem", fields: ["label"] },
  { model: "media", entityType: "Media", fields: ["name", "alt"] },
  { model: "banner", entityType: "Banner", fields: ["title", "subtitle", "description", "ctaLabel"] },
  { model: "page", entityType: "Page", fields: ["title", "excerpt", "content"] },
  { model: "pageSection", entityType: "PageSection", fields: ["title", "subtitle", "content", "buttonLabel", "items"], jsonFields: ["items"] },
  { model: "seoMeta", entityType: "SeoMeta", fields: ["title", "description", "keywords", "ogTitle", "ogDescription", "schemaJson"], jsonFields: ["schemaJson"] },
  { model: "productCategory", entityType: "ProductCategory", fields: ["name", "description"] },
  { model: "product", entityType: "Product", fields: ["name", "tagline", "summary", "description", "seoTitle", "metaDescription", "ogTitle", "ogDescription", "specifications", "features", "applications", "faqs"], jsonFields: ["specifications", "features", "applications", "faqs"] },
  { model: "productImage", entityType: "ProductImage", fields: ["alt"] },
  { model: "productDownload", entityType: "ProductDownload", fields: ["title"] },
  { model: "newsCategory", entityType: "NewsCategory", fields: ["name"] },
  { model: "news", entityType: "News", fields: ["title", "excerpt", "content", "author", "seoTitle", "metaDescription", "ogTitle", "ogDescription"] },
  { model: "factoryEquipment", entityType: "FactoryEquipment", fields: ["name", "description", "metric"] },
  { model: "workshop", entityType: "Workshop", fields: ["name", "description"] },
  { model: "certificate", entityType: "Certificate", fields: ["name"] },
];
const translationScopes = new Map(scopes.filter((scope) => scope.model !== "setting").map((scope) => [scope.entityType, scope]));
const privateOrContactSetting = /password|secret|token|credential|smtp|api[_-]?key|(?:^|_)(?:email|phone|address|url|href|path|logo)(?:_|$)/i;
const skippedInvalidJson: { model: string; field: string }[] = [];

function transform(value: string, json: boolean, model: string, field: string) {
  if (!json) return renameText(value);
  if (!oldBrand.test(value)) return value;
  try {
    const before = JSON.parse(value);
    const after = renameJsonValue(before);
    return JSON.stringify(before) === JSON.stringify(after) ? value : JSON.stringify(after);
  } catch {
    skippedInvalidJson.push({ model, field });
    return value;
  }
}

type PublicRow = { id: string } & Record<string, unknown>;
type Delegate = {
  findMany(args?: Record<string, unknown>): Promise<PublicRow[]>;
  updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
};
type Change = { model: string; id: string; original: PublicRow; before: Record<string, string>; after: Record<string, string> };
const delegates = db as unknown as Record<string, Delegate>;
const changes: Change[] = [];

async function collect() {
  for (const scope of scopes) {
    const rows = await delegates[scope.model].findMany({ ...(scope.where ? { where: scope.where } : {}) });
    for (const row of rows) {
      if (scope.model === "setting" && privateOrContactSetting.test(String(row.key || ""))) continue;
      const before: Record<string, string> = {};
      const after: Record<string, string> = {};
      for (const field of scope.fields) {
        const value = row[field];
        if (typeof value !== "string") continue;
        const replacement = transform(value, scope.jsonFields?.includes(field) || (scope.model === "setting" && row.type === "json"), scope.model, field);
        if (replacement !== value) { before[field] = value; after[field] = replacement; }
      }
      if (Object.keys(after).length) changes.push({ model: scope.model, id: row.id, original: row, before, after });
    }
  }
  const translations = await db.translation.findMany({ where: { entityType: { in: [...translationScopes.keys()] } } });
  for (const row of translations) {
    const scope = translationScopes.get(row.entityType)!;
    if (!scope.fields.includes(row.field)) continue;
    const replacement = transform(row.value, scope.jsonFields?.includes(row.field) || false, "translation", row.field);
    if (replacement !== row.value) changes.push({ model: "translation", id: row.id, original: row, before: { value: row.value }, after: { value: replacement } });
  }
}

async function main() {
try {
  await collect();
  const grouped = new Map<string, { rows: number; fields: number }>();
  for (const change of changes) {
    const count = grouped.get(change.model) || { rows: 0, fields: 0 };
    count.rows += 1; count.fields += Object.keys(change.after).length;
    grouped.set(change.model, count);
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", replacements: { chinese: chineseBrand, english: englishBrand }, affectedRows: changes.length, models: Object.fromEntries(grouped), skippedInvalidJson }, null, 2));
  if (apply && changes.length) {
    const backupDirectory = path.resolve(process.cwd(), "outputs", "brand-backups");
    await mkdir(backupDirectory, { recursive: true });
    const backupFile = path.join(backupDirectory, `shanze-brand-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(backupFile, JSON.stringify({ version: 1, createdAt: new Date().toISOString(), purpose: "Public CMS branding replacement", changes }, null, 2), { encoding: "utf8", flag: "wx" });
    await db.$transaction(async (transaction) => {
      const transactionDelegates = transaction as unknown as Record<string, Delegate>;
      for (const change of changes) {
        // Do not overwrite a content edit made after the read/backup.
        const updated = await transactionDelegates[change.model].updateMany({ where: { id: change.id, ...change.before }, data: change.after });
        if (updated.count !== 1) throw new Error(`Content changed during migration: ${change.model}/${change.id}. Transaction rolled back; backup retained.`);
      }
    }, { timeout: 30000 });
    console.log(`Applied ${changes.length} public CMS row changes. Original rows backed up at: ${backupFile}`);
  } else if (!apply) {
    console.log("Read-only preview completed. No database or file changes were made. Use --apply to back up and update the allowlisted public CMS fields.");
  } else {
    console.log("No matching legacy branding in allowlisted public CMS fields.");
  }
} finally {
  await db.$disconnect();
}
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
