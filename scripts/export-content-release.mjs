import env from '@next/env';
import { resolveSQLiteDatabasePath } from '../lib/sqlite-path.mjs';
import { exportContentRelease } from './lib/content-release.mjs';

env.loadEnvConfig(process.cwd());
try {
  const release = await exportContentRelease({ root: process.cwd(), databasePath: resolveSQLiteDatabasePath() });
  console.log(JSON.stringify({ releaseId: release.releaseId, counts: Object.fromEntries(Object.entries(release.tables).map(([table, rows]) => [table, rows.length])), assets: release.assets.length, file: 'content/site-content.json', privateDataExported: false }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
