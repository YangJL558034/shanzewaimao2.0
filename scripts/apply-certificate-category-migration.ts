import { loadEnvConfig } from "@next/env";
import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { inferCertificateCategory, isCertificateCategory } from "../lib/certificate-categories";

// Incremental SQLite migration for installations with an existing migration-history gap.
// Preview: npx tsx scripts/apply-certificate-category-migration.ts
// Apply:   npx tsx scripts/apply-certificate-category-migration.ts --apply
// No Prisma client generation, seeding, database reset or migration-history rewriting.
loadEnvConfig(process.cwd());
const apply = process.argv.includes("--apply");
const accepted = new Set(["--apply", "--dry-run"]);
for (const argument of process.argv.slice(2)) if (!accepted.has(argument)) throw new Error(`Unknown option: ${argument}`);
if (apply && process.argv.includes("--dry-run")) throw new Error("Choose --apply or --dry-run, not both.");
const migrationName = "20261014020000_certificate_categories";

type Row = Record<string, unknown> & { id: string; name: string; category?: string };

async function main() {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
  if (!databaseUrl.startsWith("file:")) throw new Error("This migration requires the current SQLite file database.");
  const sqliteFile = decodeURIComponent(databaseUrl.slice(5).split("?")[0]);
  const requestedPath = path.isAbsolute(sqliteFile) ? sqliteFile : path.resolve(process.cwd(), "prisma", sqliteFile);
  // Fail instead of accidentally creating an empty database at an incorrect path.
  const databasePath = await realpath(requestedPath);
  const migrationSql = await readFile(path.join("prisma", "migrations", migrationName, "migration.sql"), "utf8");
  const sqlite = new DatabaseSync(databasePath, { readOnly: !apply });
  let transactionOpen = false;
  try {
    sqlite.exec("PRAGMA busy_timeout = 5000");
    const definition = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'Certificate'").get();
    if (!definition) throw new Error("The resolved database has no Certificate table. No changes applied.");
    const columns = sqlite.prepare('PRAGMA table_info("Certificate")').all();
    const categoryColumn = columns.find((column) => column.name === "category");
    const existingRows = sqlite.prepare('SELECT * FROM "Certificate" ORDER BY "id"').all() as Row[];
    if (categoryColumn && existingRows.some((row) => !isCertificateCategory(row.category))) throw new Error("Existing category values need review; no changes applied.");
    if (categoryColumn && !/CHECK\s*\(\s*["`\[]?category["`\]]?\s+IN\s*\(/i.test(String(definition.sql))) throw new Error("Existing category column has no restricted-values CHECK. Review the existing schema before applying.");
    const currentIndex = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'Certificate_category_isVisible_sortOrder_idx'").get();
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", migration: migrationName, existingRows: existingRows.length, columnAlreadyExists: !!categoryColumn, plannedBackfill: categoryColumn ? [] : existingRows.map((row) => ({ id: row.id, name: row.name, category: inferCertificateCategory(row.name) })), preserve: "All existing fields, IDs, images (including user-cleared 3C image), dates, translations and other tables" }, null, 2));
    if (!apply) return;
    if (categoryColumn && currentIndex) { console.log("Certificate category migration is already applied. No changes made."); return; }

    sqlite.exec("BEGIN IMMEDIATE");
    transactionOpen = true;
    const originalRows = sqlite.prepare('SELECT * FROM "Certificate" ORDER BY "id"').all() as Row[];
    const backupDirectory = path.resolve("outputs", "certificate-category-backups");
    await mkdir(backupDirectory, { recursive: true });
    const backupFile = path.join(backupDirectory, `before-category-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(backupFile, JSON.stringify({ version: 1, createdAt: new Date().toISOString(), migration: migrationName, originalTableSql: definition.sql, originalColumns: columns, certificates: originalRows }, null, 2), { encoding: "utf8", flag: "wx" });

    if (!categoryColumn) {
      sqlite.exec(migrationSql);
      // Normalize the one-time backfill through the shared classifier, preserving every other field.
      const backfill = sqlite.prepare('UPDATE "Certificate" SET "category" = ? WHERE "id" = ?');
      for (const row of originalRows) backfill.run(inferCertificateCategory(row.name), row.id);
    } else if (!currentIndex) {
      sqlite.exec('CREATE INDEX "Certificate_category_isVisible_sortOrder_idx" ON "Certificate"("category", "isVisible", "sortOrder")');
    }

    const migrated = sqlite.prepare('SELECT * FROM "Certificate" ORDER BY "id"').all() as Row[];
    if (migrated.length !== originalRows.length) throw new Error("Certificate row count changed unexpectedly.");
    for (let index = 0; index < originalRows.length; index++) {
      const original = originalRows[index];
      const updated = migrated[index];
      if (!isCertificateCategory(updated.category)) throw new Error(`Invalid category after migration: ${updated.id}`);
      for (const field of Object.keys(original)) {
        if (field === "category") continue;
        if (JSON.stringify(original[field]) !== JSON.stringify(updated[field])) throw new Error(`Unexpected field change: Certificate.${field}. Transaction will roll back.`);
      }
    }
    sqlite.exec("COMMIT");
    transactionOpen = false;
    console.log(`Certificate categories applied safely. Original rows backed up at: ${backupFile}`);
    console.log("Existing migration history was left unchanged; coordinate deployment migration tracking separately if necessary.");
  } catch (error) {
    if (transactionOpen) sqlite.exec("ROLLBACK");
    throw error;
  } finally { sqlite.close(); }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
