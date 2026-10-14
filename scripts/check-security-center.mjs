import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import env from "@next/env";

env.loadEnvConfig(process.cwd());
const db = new PrismaClient();
const base = process.env.SECURITY_TEST_URL || "http://localhost:3000";
const runId = randomUUID();
const userIds = [];
const scanIds = [];
let readerRoleId;
let previousBaseline;
let baselineChanged = false;
const sourceFixture = path.resolve("scripts", `security-check-${runId}.txt`);
const uploadFixture = path.resolve("public/uploads", `security-check-${runId}.php`);
const baselineKey = "security_file_baseline";

async function session(roleId, name) {
  const user = await db.user.create({ data: { email: `security-${name}-${runId}@example.invalid`, name: "Security integration check", passwordHash: "disabled-test-login", roles: { create: { roleId } } } });
  userIds.push(user.id);
  const token = randomBytes(32).toString("base64url");
  await db.session.create({ data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 300000) } });
  const cookie = `enercore_session=${token}`;
  const response = await fetch(`${base}/api/csrf`, { headers: { cookie } });
  const csrf = (await response.json()).token;
  return { cookie: `${cookie}; enercore_csrf_v2=${csrf}`, "x-csrf-token": csrf, "content-type": "application/json" };
}
async function post(endpoint, headers, body) { return fetch(`${base}${endpoint}`, { method: "POST", headers, body: JSON.stringify(body) }); }
async function scan(scope, headers) {
  const response = await post("/api/admin/system/scans", headers, { scope });
  const payload = await response.json();
  assert.equal(response.status, 202, JSON.stringify(payload));
  scanIds.push(payload.data.id);
  const deadline = Date.now() + 110000;
  while (Date.now() < deadline) {
    const result = await fetch(`${base}/api/admin/system/scans?id=${payload.data.id}`, { headers });
    const current = (await result.json()).data;
    if (current.status !== "running") {
      for (let attempt = 0; attempt < 20; attempt++) {
        const audit = await db.auditLog.findFirst({ where: { entityId: current.id, action: "SECURITY_SCAN_FINISHED" } });
        if (audit) return current;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("Completed scan did not record the completion audit.");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Security scan did not complete in time.");
}

try {
  const administrator = await db.role.findFirst({ where: { permissions: { some: { permission: { key: "*" } } } } });
  const readPermission = await db.permission.findUnique({ where: { key: "security.read" } });
  assert.ok(administrator && readPermission, "Seed security permissions before testing.");
  const adminHeaders = await session(administrator.id, "admin");
  const reader = await db.role.create({ data: { name: `Security reader ${runId}`, permissions: { create: { permissionId: readPermission.id } } } });
  readerRoleId = reader.id;
  const readHeaders = await session(reader.id, "reader");
  assert.equal((await fetch(`${base}/api/admin/system`)).status, 401);
  assert.equal((await fetch(`${base}/api/admin/system`, { headers: readHeaders })).status, 200);
  assert.equal((await post("/api/admin/system/scans", readHeaders, { scope: "source" })).status, 403);
  assert.equal((await post("/api/admin/system/scans", { cookie: adminHeaders.cookie, "content-type": "application/json" }, { scope: "source" })).status, 403);
  assert.equal((await post("/api/admin/system/scans", adminHeaders, { scope: "../" })).status, 400);
  const initial = await fetch(`${base}/api/admin/system`, { headers: adminHeaders }).then((response) => response.json());
  assert.equal(initial.security.engine.available, false, "This local check expects no configured antivirus; use isolated mocks to verify virus transport.");
  assert.ok(initial.security.checks.some((check) => check.key === "antivirus" && check.status !== "pass"));
  previousBaseline = await db.setting.findUnique({ where: { key: baselineKey } });
  assert.equal((await post("/api/admin/system/baseline", adminHeaders, { confirm: false })).status, 400);
  await writeFile(sourceFixture, "Safe integration-test source fixture\n", { flag: "wx" });
  baselineChanged = true;
  const baselineResponse = await post("/api/admin/system/baseline", adminHeaders, { confirm: true });
  assert.equal(baselineResponse.status, 200, await baselineResponse.text());
  await writeFile(sourceFixture, "Changed safe integration-test fixture\n");
  const sourceScan = await scan("source", adminHeaders);
  assert.equal(sourceScan.status, "partial");
  assert.equal(sourceScan.cleanFiles, 0, "No virus engine must never produce clean virus results.");
  assert.ok(sourceScan.unscannedFiles > 0);
  assert.ok(sourceScan.findings.some((finding) => finding.type === "integrity" && finding.path === `scripts/security-check-${runId}.txt`));
  await mkdir(path.dirname(uploadFixture), { recursive: true });
  await writeFile(uploadFixture, "Harmless plain-text fixture to test executable-extension rules.\n", { flag: "wx" });
  const uploadsScan = await scan("uploads", adminHeaders);
  assert.ok(uploadsScan.findings.some((finding) => finding.type === "unsafe_file" && finding.path.endsWith(`security-check-${runId}.php`)));
  assert.equal(uploadsScan.infectedFiles, 0, "An unsafe extension is a rule finding, not a proven virus.");
  const baselineRecord = await db.setting.findUniqueOrThrow({ where: { key: baselineKey } });
  const settings = await fetch(`${base}/api/admin/settings`, { headers: adminHeaders }).then((response) => response.json());
  assert.ok(settings.data.every((item) => item.group !== "security_center"));
  const editProtected = await fetch(`${base}/api/admin/settings/${baselineRecord.id}`, { method: "PUT", headers: adminHeaders, body: JSON.stringify({ value: "forged" }) });
  assert.equal(editProtected.status, 403);
  const page = await fetch(`${base}/admin/system`, { headers: adminHeaders }).then((response) => response.text());
  assert.ok(page.includes("安全中心") && page.includes("admin-redesign"));
  assert.ok(!page.includes('href="/admin/inbox"') || page.includes("客服中心"));
  console.log("PASS: auth/RBAC/CSRF, scope confinement, no false clean results, SHA-256 baseline changes, unsafe upload rules, audit history, protected records and redesigned security page.");
} finally {
  await unlink(sourceFixture).catch(() => undefined);
  await unlink(uploadFixture).catch(() => undefined);
  if (baselineChanged) {
    if (previousBaseline) await db.setting.upsert({ where: { key: baselineKey }, create: previousBaseline, update: { value: previousBaseline.value, group: previousBaseline.group, type: previousBaseline.type, isPublic: previousBaseline.isPublic } });
    else await db.setting.deleteMany({ where: { key: baselineKey } });
  }
  for (const id of scanIds) {
    await db.setting.deleteMany({ where: { key: { in: [`security_scan_${id}`, "security_scan_lock"] }, value: { contains: id } } });
    await db.auditLog.deleteMany({ where: { entityId: id } });
  }
  if (userIds.length) {
    await db.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await db.rateLimit.deleteMany({ where: { key: { in: userIds.map((id) => `security-scan:${id}`) } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  }
  if (readerRoleId) await db.role.delete({ where: { id: readerRoleId } });
  await db.$disconnect();
}
