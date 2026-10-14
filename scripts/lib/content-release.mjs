// Portable website content only. No customer, authentication or operational tables.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';

export const contentTables = {
  Locale: ['code'], Setting: ['key'], ProductCategory: ['slug'], NewsCategory: ['slug'],
  Page: ['slug'], PageSection: ['page', 'key'], Banner: ['key'],
  FactoryEquipment: ['name'], Workshop: ['name'], Certificate: ['name'], EmailTemplate: ['key'],
  Product: ['slug'], ProductImage: ['productId', 'url', 'sortOrder'], ProductDownload: ['productId', 'fileUrl'],
  News: ['slug'], NavigationItem: ['location', 'href'], SeoMeta: ['route'], Media: ['path'],
  Translation: ['localeId', 'entityType', 'entityId', 'field'],
};
const references = {
  Product: { categoryId: 'ProductCategory' }, ProductImage: { productId: 'Product' },
  ProductDownload: { productId: 'Product' }, News: { categoryId: 'NewsCategory' },
  NavigationItem: { parentId: 'NavigationItem' }, Translation: { localeId: 'Locale' },
};
const settingNames = new Set([
  'site_name', 'site_name_zh', 'site_tagline', 'site_tagline_zh', 'logo_url', 'public_site_url',
  'company_name', 'company_name_zh', 'company_description', 'company_description_zh',
  'founded', 'technology_since', 'brand_commercialization_year', 'manufacturing_city', 'manufacturing_city_zh',
  'factory_area', 'monthly_output', 'export_countries', 'phone', 'email', 'address', 'address_zh',
  'google_maps_embed_url', 'google_maps_directions_url', 'quote_href', 'quote_label', 'quote_label_zh',
  'customer_whatsapp_number', 'customer_linkedin_url', 'customer_support_email', 'customer_catalog_url', 'customer_welcome_message',
  ...['cta_title', 'cta_description', 'cta_label', 'footer_contact_title', 'footer_copyright', 'footer_legal',
    'footer_newsletter_description', 'footer_newsletter_title', 'footer_products_title', 'footer_quick_title'].flatMap(key => [key, `${key}_zh`]),
  'cta_href', 'social_facebook', 'social_linkedin', 'social_tiktok', 'social_youtube',
]);
const stateKey = 'website_content_release_state';
const localHosts = new Set(['shanzesz.com', 'www.shanzesz.com', 'localhost', '127.0.0.1', '127.0.0.2', '192.168.0.208', '0.0.0.0']);
const assetPattern = /(?:https?:\/\/[^\s"'<>\\/]+)?\/(?:uploads|optimized|generated|company-profile|references|content-assets)\/[^\s"'<>\\?#)\]}]+/g;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const quote = value => `"${value.replaceAll('"', '""')}"`;
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b, 'en'))) : item);
const fingerprint = row => hash(stable(Object.fromEntries(Object.entries(row).filter(([key]) => !['id', 'createdAt', 'updatedAt'].includes(key)))));
const allowedSetting = row => Boolean(row.isPublic) && settingNames.has(row.key);
const inside = (root, target) => { const relative = path.relative(root, target); return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); };

export function createContentRelease(tables, assets) {
  const payload = { schemaVersion: 1, tables, assets };
  return { ...payload, releaseId: hash(stable(payload)) };
}

function assetPath(value) {
  const url = new URL(value, 'https://shanzesz.com');
  if (!localHosts.has(url.hostname)) return null;
  return decodeURIComponent(url.pathname);
}

export async function exportContentRelease({ root, databasePath }) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  const tables = {};
  // One read transaction: pages, relationships and translations share a snapshot.
  db.exec('BEGIN');
  try {
    for (const table of Object.keys(contentTables)) {
      let rows = db.prepare(`SELECT * FROM ${quote(table)} ORDER BY id`).all();
      if (table === 'Setting') rows = rows.filter(allowedSetting);
      if (table === 'Media') rows = rows.filter(row => !row.isPrivate);
      if (table === 'Translation') rows = rows.filter(row => tables.Locale.some(locale => locale.id === row.localeId)
        && tables[row.entityType]?.some(entity => entity.id === row.entityId));
      tables[table] = rows.map(row => ({ ...row }));
    }
  } finally { db.exec('ROLLBACK'); db.close(); }

  const publicRoot = await realpath(path.join(root, 'public'));
  const aliases = new Map();
  const assets = new Map();
  const manifest = JSON.parse(await readFile(path.join(publicRoot, 'optimized/image-seo-manifest.json'), 'utf8').catch(() => '{}'));
  async function collect(value) {
    for (const match of value.matchAll(assetPattern)) {
      const source = assetPath(match[0]);
      if (!source) continue; // Preserve external content without downloading it.
      if (aliases.has(match[0])) continue;
      assert.ok(!source.includes('..') && !source.includes('\\'), `Unsafe content asset: ${source}`);
      const mapped = source.startsWith('/uploads/') ? manifest[source]?.src || source : source;
      const absolute = await realpath(path.join(publicRoot, mapped));
      assert.ok(inside(publicRoot, absolute), `Content asset must be public: ${source}`);
      const info = await stat(absolute);
      assert.ok(info.isFile() && info.size <= 128 * 1024 * 1024, `Missing/oversized public asset: ${source}`);
      const bytes = await readFile(absolute);
      const sha256 = hash(bytes);
      let destination = mapped;
      if (mapped.startsWith('/uploads/')) {
        const basename = path.basename(mapped, path.extname(mapped)).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 55) || 'website-asset';
        destination = `/content-assets/${basename}-${sha256.slice(0, 16)}${path.extname(mapped).toLowerCase()}`;
        await mkdir(path.join(publicRoot, 'content-assets'), { recursive: true });
        const target = path.join(publicRoot, destination);
        try { await writeFile(target, bytes, { flag: 'wx' }); }
        catch (error) { if (error.code !== 'EEXIST' || hash(await readFile(target)) !== sha256) throw error; }
      }
      aliases.set(match[0], destination);
      assets.set(destination, { path: destination, sha256, size: bytes.length });
    }
  }
  for (const rows of Object.values(tables)) for (const row of rows) for (const value of Object.values(row)) {
    if (typeof value === 'string') {
      assert.ok(!/\/storage\/private\//i.test(value), 'A private attachment cannot be published as website content');
      await collect(value);
    }
  }
  const oldMediaPaths = new Map(tables.Media.map(row => [row.id, row.path]));
  for (const rows of Object.values(tables)) for (const row of rows) for (const [field, value] of Object.entries(row)) {
    if (typeof value === 'string') row[field] = value.replace(assetPattern, match => aliases.get(match) || match);
  }
  for (const row of tables.Media) if (oldMediaPaths.get(row.id) !== row.path) {
    row.fileName = path.basename(row.path);
    row.size = assets.get(row.path)?.size || row.size;
    if (row.path.endsWith('.webp')) {
      row.mimeType = 'image/webp';
      const details = manifest[oldMediaPaths.get(row.id)];
      if (details?.width) row.width = details.width;
      if (details?.height) row.height = details.height;
    }
  }
  // Register copied images under their portable public path; deduplicate legacy aliases.
  tables.Media = tables.Media.filter((row, index, rows) => rows.findIndex(item => item.path === row.path) === index);
  const release = createContentRelease(tables, [...assets.values()].sort((a, b) => a.path.localeCompare(b.path, 'en')));
  await mkdir(path.join(root, 'content'), { recursive: true });
  await writeFile(path.join(root, 'content/site-content.json'), JSON.stringify(release, null, 2) + '\n');
  return release;
}

export async function validateRelease(root, release, db) {
  assert.equal(release.schemaVersion, 1, 'Unsupported content release format');
  assert.equal(release.releaseId, hash(stable({ schemaVersion: release.schemaVersion, tables: release.tables, assets: release.assets })), 'Content release checksum differs');
  assert.deepEqual(Object.keys(release.tables), Object.keys(contentTables), 'Only reviewed website tables may be imported');
  for (const [table, rows] of Object.entries(release.tables)) {
    const columns = new Set(db.prepare(`PRAGMA table_info(${quote(table)})`).all().map(column => column.name));
    assert.ok(columns.size, `Database schema not prepared: ${table}; run npm run db:deploy`);
    const ids = new Set();
    for (const row of rows) {
      assert.ok(row.id && !ids.has(row.id), `Duplicate content id: ${table}`); ids.add(row.id);
      for (const [field, value] of Object.entries(row)) {
        assert.ok(columns.has(field), `Unknown content field: ${table}.${field}`);
        assert.ok(value === null || ['string', 'number'].includes(typeof value), `Invalid scalar: ${table}.${field}`);
        if (typeof value === 'string') assert.ok(!/\/storage\/private\//i.test(value), 'Private file reference in content');
      }
      if (table === 'Setting') assert.ok(allowedSetting(row), `Non-public setting blocked: ${row.key}`);
      if (table === 'Media') assert.equal(Number(row.isPrivate), 0, 'Private media blocked');
    }
  }
  const publicRoot = await realpath(path.join(root, 'public'));
  for (const asset of release.assets) {
    assert.ok(/^\/(?:generated|optimized|company-profile|references|content-assets)\//.test(asset.path) && !asset.path.includes('..') && !asset.path.includes('\\'), 'Unsafe release asset path');
    const absolute = await realpath(path.join(publicRoot, asset.path));
    assert.ok(inside(publicRoot, absolute), 'Release asset outside public');
    const bytes = await readFile(absolute);
    assert.equal(bytes.length, asset.size, `Asset size differs: ${asset.path}`);
    assert.equal(hash(bytes), asset.sha256, `Asset checksum differs: ${asset.path}`);
  }
}

function mappedRow(table, row, maps) {
  const data = { ...row };
  for (const [field, target] of Object.entries(references[table] || {})) {
    if (data[field] !== null) { assert.ok(maps[target]?.has(data[field]), `Missing content relation: ${table}.${field}`); data[field] = maps[target].get(data[field]); }
  }
  if (table === 'Translation') {
    assert.ok(maps[data.entityType]?.has(data.entityId), 'Translation must belong to released website content');
    data.entityId = maps[data.entityType].get(data.entityId);
  }
  return data;
}

export async function importContentRelease({ root, databasePath, apply = false, force = false, release: supplied }) {
  const release = supplied || JSON.parse(await readFile(path.join(root, 'content/site-content.json'), 'utf8'));
  const reader = new DatabaseSync(databasePath, { readOnly: true });
  let state, backupPath;
  try {
    await validateRelease(root, release, reader);
    assert.equal(reader.prepare('PRAGMA integrity_check').get().integrity_check, 'ok', 'Database integrity failed');
    const value = reader.prepare('SELECT value FROM Setting WHERE key=?').get(stateKey)?.value;
    state = value ? JSON.parse(value) : { records: {} };
    if (state.releaseId === release.releaseId && !force) return { mode: apply ? 'apply' : 'preview', releaseId: release.releaseId, unchanged: true, counts: Object.fromEntries(Object.entries(release.tables).map(([key, rows]) => [key, rows.length])) };
    if (apply) {
      const directory = path.join(root, 'storage/private/content-release-backups');
      await mkdir(directory, { recursive: true, mode: 0o700 });
      backupPath = path.join(directory, `${Date.now()}-${randomUUID()}.db`);
      await backup(reader, backupPath);
      if (process.platform !== 'win32') { const { chmod } = await import('node:fs/promises'); await chmod(backupPath, 0o600); }
    }
  } finally { reader.close(); }
  const db = new DatabaseSync(databasePath, { readOnly: !apply });
  db.exec('PRAGMA busy_timeout=5000');
  const maps = {}, operations = [], conflicts = [], tracked = { ...state.records };
  let transaction = false;
  try {
    if (apply) {
      db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE; PRAGMA defer_foreign_keys=ON'); transaction = true;
      const latest = db.prepare('SELECT value FROM Setting WHERE key=?').get(stateKey)?.value;
      assert.equal(latest ? JSON.parse(latest).releaseId : undefined, state.releaseId, 'Another deployment changed the release state; retry after it finishes');
    }
    // Resolve natural keys first, preserving production ids referenced by CRM.
    for (const [table, keys] of Object.entries(contentTables)) {
      maps[table] = new Map();
      for (const source of release.tables[table]) {
        // Navigation parent ids are remapped after all navigation ids are known.
        const candidate = table === 'NavigationItem' ? source : mappedRow(table, source, maps);
        const byId = db.prepare(`SELECT * FROM ${quote(table)} WHERE id=?`).get(source.id);
        const matches = db.prepare(`SELECT * FROM ${quote(table)} WHERE ${keys.map(key => `${quote(key)} IS ?`).join(' AND ')}`).all(...keys.map(key => candidate[key]));
        let existing = byId || (matches.length === 1 ? matches[0] : undefined);
        assert.ok(byId || matches.length <= 1, `Ambiguous content key: ${table}`);
        if (!existing && table === 'Product') existing = db.prepare('SELECT * FROM Product WHERE sku=?').get(source.sku);
        if (!existing && table === 'Certificate' && source.certificateNo) {
          const matching = db.prepare('SELECT * FROM Certificate WHERE certificateNo=?').all(source.certificateNo);
          if (matching.length === 1) existing = matching[0];
        }
        // Match the original empty issuer-only placeholder when its name was edited.
        if (!existing && table === 'Certificate' && source.issuer && !source.certificateNo && !source.image) {
          const matching = db.prepare('SELECT * FROM Certificate WHERE issuer=? AND certificateNo IS NULL AND (image IS NULL OR image=\'\')').all(source.issuer);
          if (matching.length === 1) existing = matching[0];
        }
        const destination = existing?.id || source.id;
        assert.ok(![...maps[table].values()].includes(destination), `Two source records resolve to the same ${table} row`);
        maps[table].set(source.id, destination);
        operations.push({ table, source, existing, destination });
      }
    }
    let created = 0, updated = 0, skipped = 0;
    for (const { table, source, existing, destination } of operations) {
      const data = { ...mappedRow(table, source, maps), id: destination };
      const token = `${table}:${source.id}`;
      const previous = state.records?.[token];
      if (existing && previous && fingerprint(existing) !== previous.fingerprint && !force) {
        conflicts.push({ table, key: contentTables[table].map(key => source[key]).join(' / ') }); skipped++; continue;
      }
      if (existing && fingerprint(existing) === fingerprint(data)) skipped++;
      else if (existing) {
        updated++;
        if (apply) {
          const fields = Object.keys(data).filter(key => !['id', 'createdAt', 'updatedAt'].includes(key));
          if ('updatedAt' in data) { fields.push('updatedAt'); data.updatedAt = Date.now(); }
          db.prepare(`UPDATE ${quote(table)} SET ${fields.map(field => `${quote(field)}=?`).join(',')} WHERE id=?`).run(...fields.map(field => data[field]), destination);
        }
      } else {
        created++;
        if (apply) { const fields = Object.keys(data); db.prepare(`INSERT INTO ${quote(table)} (${fields.map(quote).join(',')}) VALUES (${fields.map(() => '?').join(',')})`).run(...fields.map(field => data[field])); }
      }
      tracked[token] = { id: destination, fingerprint: fingerprint(data) };
    }
    if (apply) {
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [], 'Content relations failed; changes rolled back');
      const value = JSON.stringify({ releaseId: release.releaseId, appliedAt: new Date().toISOString(), records: tracked });
      db.prepare('INSERT INTO Setting (id,"group",key,value,type,isPublic,updatedAt) VALUES (?,\'deployment\',?,?,\'json\',0,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updatedAt=excluded.updatedAt')
        .run(randomUUID(), stateKey, value, Date.now());
      db.exec('COMMIT'); transaction = false;
    }
    return { mode: apply ? 'apply' : 'preview', releaseId: release.releaseId, created, updated, skipped, conflicts, ...(backupPath ? { backupPath } : {}) };
  } catch (error) { if (transaction) db.exec('ROLLBACK'); throw error; }
  finally { db.close(); }
}
