import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { resolveSQLiteDatabasePath } from "../lib/sqlite-path.mjs";

const projectRoot = process.cwd();
nextEnv.loadEnvConfig(projectRoot, process.env.NODE_ENV === "development");
// Validate before creating any directories or files. Like Next.js, explicitly
// supplied environment variables take precedence over .env* configuration.
const databasePath = resolveSQLiteDatabasePath(process.env.DATABASE_URL, projectRoot);
const persistentDirectories = [
  path.join(projectRoot, "public", "uploads"),
  path.join(projectRoot, "storage", "private"),
  path.join(projectRoot, "backups"),
];

for (const directory of persistentDirectories) {
  await mkdir(directory, { recursive: true });
}

await mkdir(path.dirname(databasePath), { recursive: true });
const databaseFile = await open(databasePath, "a");
await databaseFile.close();

console.log(`SQLite storage is ready at ${databasePath}`);
