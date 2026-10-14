import path from "node:path";

/**
 * Prisma SQLite URLs are file: paths relative to prisma/schema.prisma, not
 * WHATWG file URLs. Prisma 6 preserves percent escapes literally in filenames.
 * Do not decode %20 into a space: doing so can back up a different database.
 */
export function resolveSQLiteDatabasePath(databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db", projectRoot = process.cwd(), platform = process.platform) {
  if (typeof databaseUrl !== "string" || !databaseUrl.startsWith("file:") || /[\u0000-\u001f\u007f]/.test(databaseUrl)) {
    throw new Error("DATABASE_URL must be a valid file: SQLite path.");
  }
  const filename = databaseUrl.slice(5).split("?")[0];
  if (!filename || filename.trim() !== filename || filename === ":memory:" || /^(?:\/\/|\\\\)/.test(filename) || /[\\/]$/.test(filename) || filename.includes("#")) {
    throw new Error("DATABASE_URL must name a local SQLite file; use file:./dev.db or file:/absolute/path/site.db (not file:// URLs).");
  }
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  if (platform !== "win32" && (/^[a-z]:/i.test(filename) || filename.includes("\\"))) {
    throw new Error("DATABASE_URL contains a Windows path; configure a Linux filesystem path on the server.");
  }
  if (platform === "win32" && (/^[a-z]:(?![\\/])/i.test(filename) || /^[\\/](?![a-z]:)/i.test(filename))) {
    throw new Error("DATABASE_URL must use an absolute drive path or a path relative to prisma on Windows.");
  }
  if (filename === "." || filename === "..") throw new Error("DATABASE_URL must name a database file, not a directory.");
  return pathApi.isAbsolute(filename) ? pathApi.normalize(filename) : pathApi.resolve(projectRoot, "prisma", filename);
}
