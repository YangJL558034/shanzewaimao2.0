import env from '@next/env';
import { resolveSQLiteDatabasePath } from '../lib/sqlite-path.mjs';
import { importContentRelease } from './lib/content-release.mjs';

env.loadEnvConfig(process.cwd(), process.env.NODE_ENV === 'development');
const options = new Set(process.argv.slice(2));
try {
  for (const option of options) if (!['--apply', '--force-content'].includes(option)) throw new Error(`Unknown option: ${option}`);
  if (options.has('--force-content') && !options.has('--apply')) throw new Error('--force-content requires --apply');
  const result = await importContentRelease({ root: process.cwd(), databasePath: resolveSQLiteDatabasePath(), apply: options.has('--apply'), force: options.has('--force-content') });
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(`Website content import failed: ${error.message}`); process.exitCode = 1; }
