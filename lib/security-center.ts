import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { getAntivirusStatus, scanBufferForViruses, type AntivirusStatus } from "@/lib/antivirus";
import { hasSafeFileSignature } from "@/lib/security";
import { getSmtpConfig } from "@/lib/smtp-settings";

export type SecurityFinding = { path: string; type: "virus" | "integrity" | "unsafe_file" | "scan_error" | "config"; severity: "critical" | "high" | "medium" | "info"; detail: string };
export type SecurityScan = { id: string; status: "running" | "completed" | "partial" | "failed"; scope: "all" | "uploads" | "source"; startedAt: string; completedAt: string | null; totalFiles: number; scannedFiles: number; cleanFiles: number; infectedFiles: number; errorFiles: number; changedFiles: number; unscannedFiles: number; findings: SecurityFinding[]; engine: AntivirusStatus };
type Baseline = { createdAt: string; hashes: Record<string, string> };
type ScanFile = { absolute: string; relative: string; area: "source" | "uploads"; size: number };
const baselineKey = "security_file_baseline";
const scanPrefix = "security_scan_";
const lockKey = "security_scan_lock";
const group = "security_center";
const maxFiles = Math.max(100, Math.min(5000, Number(process.env.SECURITY_SCAN_MAX_FILES) || 1000));
const maxFileBytes = 40 * 1024 * 1024;
const maxScanMs = 90_000;

function inside(root: string, target: string) { const relative = path.relative(root, target); return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)); }
function relativeName(root: string, target: string) { return path.relative(root, target).split(path.sep).join("/"); }
function sha256(buffer: Buffer) { return createHash("sha256").update(buffer).digest("hex"); }
function parse<T>(value?: string): T | null { try { return value ? JSON.parse(value) as T : null; } catch { return null; } }

/** The API never accepts arbitrary directories; symlinks are recorded and skipped. */
export async function collectSecurityFiles(scope: SecurityScan["scope"]) {
  const root = await realpath(process.cwd());
  const files: ScanFile[] = [];
  const findings: SecurityFinding[] = [];
  let truncated = false;
  const visit = async (target: string, area: ScanFile["area"]) => {
    if (files.length >= maxFiles) { truncated = true; return; }
    if (!inside(root, target)) return;
    const info = await lstat(target).catch(() => null);
    if (!info) return;
    const relative = relativeName(root, target);
    if (info.isSymbolicLink()) { findings.push({ path: relative, type: "unsafe_file", severity: "high", detail: "跳过符号链接，避免扫描范围越出网站目录。" }); return; }
    const resolved = await realpath(target).catch(() => null);
    if (!resolved || !inside(root, resolved)) { findings.push({ path: relative, type: "unsafe_file", severity: "high", detail: "路径未通过网站目录边界检查。" }); return; }
    if (info.isDirectory()) {
      const entries = await readdir(target).catch(() => null);
      if (!entries) { findings.push({ path: relative, type: "scan_error", severity: "medium", detail: "目录无法读取。" }); return; }
      for (const entry of entries.sort()) await visit(path.join(target, entry), area);
    } else if (info.isFile()) files.push({ absolute: target, relative, area, size: info.size });
  };
  // Uploads have priority so a large source tree cannot crowd out untrusted files.
  // These are deployment-time scan roots, not assets to package into the server bundle.
  if (scope !== "source") for (const directory of ["public/uploads", "storage/private"]) await visit(path.join(/*turbopackIgnore: true*/ root, directory), "uploads");
  if (scope !== "uploads") {
    for (const directory of ["app", "components", "lib", "scripts", "prisma/migrations"]) await visit(path.join(/*turbopackIgnore: true*/ root, directory), "source");
    for (const name of ["package.json", "package-lock.json", "next.config.ts", "proxy.ts", "instrumentation.ts", "prisma/schema.prisma"]) await visit(path.join(/*turbopackIgnore: true*/ root, name), "source");
  }
  return { files, findings, truncated };
}

export async function getFileBaseline() {
  const row = await db.setting.findUnique({ where: { key: baselineKey } });
  return parse<Baseline>(row?.value);
}

export async function createFileBaseline(userId: string) {
  const collected = await collectSecurityFiles("source");
  if (collected.truncated || collected.findings.length) throw new Error("源码目录读取不完整，请处理扫描错误后再建立基线。");
  const hashes: Record<string, string> = {};
  for (const file of collected.files) {
    if (file.size > maxFileBytes) throw new Error(`文件过大，无法纳入基线：${file.relative}`);
    hashes[file.relative] = sha256(await readFile(file.absolute));
  }
  const baseline: Baseline = { createdAt: new Date().toISOString(), hashes };
  await db.setting.upsert({ where: { key: baselineKey }, create: { key: baselineKey, group, value: JSON.stringify(baseline), type: "json", isPublic: false }, update: { value: JSON.stringify(baseline), group, isPublic: false } });
  await db.auditLog.create({ data: { userId, action: "SECURITY_BASELINE_CREATED", entityType: "security", afterJson: JSON.stringify({ files: Object.keys(hashes).length, createdAt: baseline.createdAt }) } });
  return { createdAt: baseline.createdAt, files: Object.keys(hashes).length };
}

export async function getSecurityScan(id: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
  const row = await db.setting.findUnique({ where: { key: `${scanPrefix}${id}` } });
  return parse<SecurityScan>(row?.value);
}

async function saveScan(scan: SecurityScan) {
  await db.setting.upsert({ where: { key: `${scanPrefix}${scan.id}` }, create: { key: `${scanPrefix}${scan.id}`, group, value: JSON.stringify(scan), type: "json", isPublic: false }, update: { value: JSON.stringify(scan), group, isPublic: false } });
}

export async function listSecurityScans() {
  const records = await db.setting.findMany({ where: { group, key: { startsWith: scanPrefix, not: lockKey } }, orderBy: { updatedAt: "desc" }, take: 20 });
  return records.map((row) => parse<SecurityScan>(row.value)).filter((scan): scan is SecurityScan => Boolean(scan)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function createSecurityScan(scope: SecurityScan["scope"], userId: string) {
  const engine = await getAntivirusStatus();
  const id = randomUUID();
  const scan: SecurityScan = { id, scope, status: "running", startedAt: new Date().toISOString(), completedAt: null, totalFiles: 0, scannedFiles: 0, cleanFiles: 0, infectedFiles: 0, errorFiles: 0, changedFiles: 0, unscannedFiles: 0, findings: [], engine };
  await db.$transaction(async (tx) => {
    const lock = await tx.setting.findUnique({ where: { key: lockKey } });
    const value = parse<{ id: string; expiresAt: number }>(lock?.value);
    if (value && value.expiresAt > Date.now()) throw new Error("已有安全检测正在运行，请等待完成。");
    if (value) {
      const abandoned = await tx.setting.findUnique({ where: { key: `${scanPrefix}${value.id}` } });
      const previous = parse<SecurityScan>(abandoned?.value);
      if (previous?.status === "running") {
        previous.status = "failed"; previous.completedAt = new Date().toISOString();
        previous.findings.push({ path: "检测任务", type: "scan_error", severity: "medium", detail: "上次任务超时或服务重启，请重新检测。" });
        await tx.setting.update({ where: { key: `${scanPrefix}${value.id}` }, data: { value: JSON.stringify(previous) } });
      }
    }
    await tx.setting.upsert({ where: { key: lockKey }, create: { key: lockKey, group, value: JSON.stringify({ id, expiresAt: Date.now() + 180_000 }), isPublic: false }, update: { value: JSON.stringify({ id, expiresAt: Date.now() + 180_000 }) } });
    await tx.setting.create({ data: { key: `${scanPrefix}${id}`, group, value: JSON.stringify(scan), type: "json", isPublic: false } });
    await tx.auditLog.create({ data: { userId, action: "SECURITY_SCAN_STARTED", entityType: "security", entityId: id, afterJson: JSON.stringify({ scope, engine: engine.engine }) } });
  });
  return scan;
}

const forbiddenUploadExtensions = new Set([".php", ".phtml", ".phar", ".asp", ".aspx", ".jsp", ".jspx", ".cgi", ".exe", ".dll", ".bat", ".cmd", ".ps1", ".sh", ".js", ".html", ".htm", ".svg", ".lnk", ".scr"]);
const mimeByExtension: Record<string, string> = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp4": "video/mp4", ".webm": "video/webm", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };

export async function runSecurityScan(scan: SecurityScan, userId: string) {
  const started = Date.now();
  const addFinding = (finding: SecurityFinding) => { if (scan.findings.length < 400) scan.findings.push(finding); };
  try {
    const [{ files, findings, truncated }, baseline, attachmentHashes] = await Promise.all([
      collectSecurityFiles(scan.scope), getFileBaseline(),
      db.inquiryAttachment.findMany({ select: { path: true, sha256: true } }),
    ]);
    const attachmentMap = new Map(attachmentHashes.map((item) => [path.resolve(item.path), item.sha256]));
    scan.totalFiles = files.length;
    findings.forEach(addFinding);
    scan.errorFiles += findings.filter((finding) => finding.type === "scan_error").length;
    if (truncated) addFinding({ path: "检测范围", type: "scan_error", severity: "medium", detail: `已达到单次 ${maxFiles} 个文件上限，部分文件未检查。` });
    if (!baseline && scan.scope !== "uploads") addFinding({ path: "源码完整性", type: "config", severity: "medium", detail: "尚未建立可信源码基线，无法判断源码是否被修改。" });
    if (!scan.engine.available) addFinding({ path: "病毒引擎", type: "config", severity: "high", detail: "病毒引擎未连接，本次仅执行文件规则和完整性检查，不代表文件无病毒。" });
    for (const file of files) {
      if (Date.now() - started >= maxScanMs) { addFinding({ path: "检测任务", type: "scan_error", severity: "medium", detail: "达到单次运行时间上限，剩余文件未检查。" }); break; }
      try {
        // Recheck the final target immediately before reading, including parent links.
        const current = await realpath(file.absolute);
        if (current !== file.absolute || !inside(await realpath(process.cwd()), current)) throw new Error("文件路径在检测期间改变，已跳过。");
        if ((await lstat(current)).size > maxFileBytes) {
          scan.unscannedFiles++; scan.scannedFiles++;
          addFinding({ path: file.relative, type: "scan_error", severity: "info", detail: "超过 40MB 单文件检测上限，未执行内容/病毒扫描。" });
          continue;
        }
        const buffer = await readFile(current);
        const hash = sha256(buffer);
        if (file.area === "source" && baseline) {
          const expected = baseline.hashes[file.relative];
          if (!expected || expected !== hash) { scan.changedFiles++; addFinding({ path: file.relative, type: "integrity", severity: expected ? "high" : "medium", detail: expected ? "文件 SHA-256 与可信基线不一致，请核实最近部署或文件修改。" : "基线之后新增的源码文件，请核实来源。" }); }
        }
        if (file.area === "uploads") {
          const ext = path.extname(file.relative).toLowerCase();
          if (forbiddenUploadExtensions.has(ext) || path.basename(file.relative).toLowerCase() === ".htaccess") addFinding({ path: file.relative, type: "unsafe_file", severity: "high", detail: "上传目录存在可执行脚本或主动内容，需人工核实；该规则不是病毒判定。" });
          const mime = mimeByExtension[ext];
          if (mime && !hasSafeFileSignature(buffer, mime)) addFinding({ path: file.relative, type: "unsafe_file", severity: "high", detail: "文件头与扩展名不一致。" });
          const recordedHash = attachmentMap.get(file.absolute);
          if (recordedHash && recordedHash !== hash) { scan.changedFiles++; addFinding({ path: file.relative, type: "integrity", severity: "high", detail: "询盘附件 SHA-256 与上传时记录不一致。" }); }
        }
        if (scan.engine.available) {
          const result = await scanBufferForViruses(buffer, file.relative);
          if (result.status === "clean") scan.cleanFiles++;
          else if (result.status === "infected") { scan.infectedFiles++; addFinding({ path: file.relative, type: "virus", severity: "critical", detail: result.detail }); }
          else { scan.unscannedFiles++; if (result.status === "error") scan.errorFiles++; addFinding({ path: file.relative, type: "scan_error", severity: "medium", detail: result.detail }); }
        } else scan.unscannedFiles++;
        scan.scannedFiles++;
      } catch (error) {
        scan.errorFiles++; scan.scannedFiles++; scan.unscannedFiles++;
        addFinding({ path: file.relative, type: "scan_error", severity: "medium", detail: error instanceof Error ? error.message : "文件无法检查。" });
      }
      if (scan.scannedFiles % 5 === 0) await saveScan(scan);
    }
    scan.unscannedFiles += Math.max(0, scan.totalFiles - scan.scannedFiles);
    if (baseline && scan.scope !== "uploads" && !truncated && scan.scannedFiles === scan.totalFiles) {
      const currentSource = new Set(files.filter((file) => file.area === "source").map((file) => file.relative));
      for (const name of Object.keys(baseline.hashes)) if (!currentSource.has(name)) { scan.changedFiles++; addFinding({ path: name, type: "integrity", severity: "high", detail: "可信基线中的源码文件已缺失。" }); }
    }
    scan.status = !scan.engine.available || truncated || scan.scannedFiles < scan.totalFiles || scan.unscannedFiles > 0 || scan.errorFiles > 0 || (!baseline && scan.scope !== "uploads") ? "partial" : "completed";
  } catch (error) { scan.status = "failed"; scan.errorFiles++; addFinding({ path: "检测任务", type: "scan_error", severity: "high", detail: error instanceof Error ? error.message : "检测任务失败。" }); }
  finally {
    scan.completedAt = new Date().toISOString();
    await saveScan(scan);
    await db.setting.deleteMany({ where: { key: lockKey, value: { contains: scan.id } } });
    await db.auditLog.create({ data: { userId, action: "SECURITY_SCAN_FINISHED", entityType: "security", entityId: scan.id, afterJson: JSON.stringify({ status: scan.status, inspected: scan.scannedFiles, viruses: scan.infectedFiles, changed: scan.changedFiles, unscanned: scan.unscannedFiles }) } });
    const older = await db.setting.findMany({ where: { group, key: { startsWith: scanPrefix, not: lockKey } }, orderBy: { updatedAt: "desc" }, skip: 20, select: { id: true } });
    if (older.length) await db.setting.deleteMany({ where: { id: { in: older.map((item) => item.id) } } });
  }
  return scan;
}

export async function getSecurityOverview() {
  const [engine, baseline, recentScans, smtp, users, failedLogins, migrationTables] = await Promise.all([
    getAntivirusStatus(), getFileBaseline(), listSecurityScans(), getSmtpConfig(),
    db.user.findMany({ where: { isActive: true }, select: { email: true } }),
    db.loginLog.count({ where: { success: false, createdAt: { gte: new Date(Date.now() - 86400000) } } }),
    db.$queryRawUnsafe<Array<{ name: string }>>("SELECT name FROM sqlite_master WHERE name = '_prisma_migrations'"),
  ]);
  const secret = process.env.APP_SECRET || "";
  const secretStrong = secret.length >= 32 && !/change|development|replace|example/i.test(secret);
  const productionHttps = /^https:\/\//i.test(process.env.NEXT_PUBLIC_SITE_URL || "");
  const checks = [
    { key: "antivirus", label: "病毒扫描引擎", status: engine.available ? "pass" : "warn", detail: engine.detail },
    { key: "integrity", label: "源码完整性基线", status: baseline ? "pass" : "warn", detail: baseline ? `已登记 ${Object.keys(baseline.hashes).length} 个源码文件，可检查新增、修改和删除。` : "尚未建立。首次建立前应确认当前部署代码可信。" },
    { key: "upload-policy", label: "上传文件防护", status: process.env.ANTIVIRUS_REQUIRE_CLEAN === "true" && !engine.available ? "fail" : engine.available ? "pass" : "warn", detail: process.env.ANTIVIRUS_REQUIRE_CLEAN === "true" ? "严格模式：未通过病毒扫描的文件禁止上传。" : engine.available ? "上传白名单、文件头验证和病毒检测已启用。" : "白名单和文件头检查已启用；病毒引擎未连接，当前为监测模式。" },
    { key: "app-secret", label: "应用加密密钥", status: secretStrong ? "pass" : "warn", detail: secretStrong ? "已配置非示例的长密钥；不展示密钥内容。" : "建议配置至少 32 位的随机 APP_SECRET，保护会话及邮箱凭据。" },
    { key: "https", label: "网站 HTTPS", status: productionHttps ? "pass" : "warn", detail: productionHttps ? "网站正式地址使用 HTTPS。" : "当前网站地址未使用 HTTPS；本地开发可用，上线需 HTTPS。" },
    { key: "admins", label: "管理员账号", status: users.some((user) => /@enercore\.com$|@example\./i.test(user.email)) ? "warn" : "pass", detail: users.some((user) => /@enercore\.com$|@example\./i.test(user.email)) ? "存在示例管理员邮箱，请上线前修改账号并使用强密码。" : `${users.length} 个启用账号，由权限系统控制访问。` },
    { key: "login-events", label: "最近 24 小时登录失败", status: failedLogins >= 20 ? "warn" : "pass", detail: `记录 ${failedLogins} 次失败登录，可在登录日志查看。` },
    { key: "database-migrations", label: "数据库迁移记录", status: migrationTables.length ? "pass" : "warn", detail: migrationTables.length ? "数据库已登记迁移历史。" : "数据库缺少迁移历史；上线迁移前应备份并登记基线。" },
    { key: "smtp", label: "邮件通知服务", status: smtp.host && smtp.user && smtp.password ? "pass" : "warn", detail: smtp.host && smtp.user && smtp.password ? "SMTP 已配置，请通过测试邮件确认投递。" : "尚未配置完整 SMTP；安全检测记录可在后台查看。" },
  ];
  return { engine, latestScan: recentScans[0] || null, recentScans, baseline: { createdAt: baseline?.createdAt || null, files: baseline ? Object.keys(baseline.hashes).length : 0 }, checks };
}
