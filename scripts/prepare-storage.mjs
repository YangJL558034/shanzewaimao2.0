import { mkdir, open } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const persistentDirectories = [
  path.join(projectRoot, "public", "uploads"),
  path.join(projectRoot, "storage", "private"),
  path.join(projectRoot, "backups"),
];

for (const directory of persistentDirectories) {
  await mkdir(directory, { recursive: true });
}

const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";

if (!databaseUrl.startsWith("file:")) {
  throw new Error("DATABASE_URL must use a file: SQLite URL.");
}

const sqlitePath = decodeURIComponent(databaseUrl.slice("file:".length).split("?")[0]);
const databasePath = path.isAbsolute(sqlitePath)
  ? sqlitePath
  : path.resolve(projectRoot, "prisma", sqlitePath);

await mkdir(path.dirname(databasePath), { recursive: true });
const databaseFile = await open(databasePath, "a");
await databaseFile.close();

console.log(`SQLite storage is ready at ${databasePath}`);
