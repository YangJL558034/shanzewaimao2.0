// Default: read-only. Explicit application adopts existing business content,
// verifies every schema object, backs up SQLite, and only repairs its ledger.
import env from '@next/env';
import { reconcileHistory } from './lib/migration-history.mjs';

const options = new Set(process.argv.slice(2));
for (const option of options) {
  if (!['--apply', '--dry-run', '--adopt-existing-content'].includes(option)) throw new Error(`Unknown option: ${option}`);
}
if (options.has('--apply') && options.has('--dry-run')) throw new Error('Choose --apply or --dry-run');
env.loadEnvConfig(process.cwd());
try {
  const result = await reconcileHistory({ root: process.cwd(), databaseUrl: process.env.DATABASE_URL, apply: options.has('--apply'), adoptExistingContent: options.has('--adopt-existing-content') });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
