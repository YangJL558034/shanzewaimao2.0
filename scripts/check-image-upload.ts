/** Exercise the real upload handler with a temporary filesystem and mocked auth/DB/antivirus.
 * No user sessions, real media records or network services are accessed.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

async function main() {
  const root = process.cwd();
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "shanze-image-upload-check-"));
  const records: Array<Record<string, unknown>> = [];
  const audit: unknown[] = [];
  let denyPermission = false;
  let infected = false;
  const scope = globalThis as typeof globalThis & { __imageUploadCheck?: Record<string, unknown> };
  scope.__imageUploadCheck = {
    db: { media: { create: async ({ data }: { data: Record<string, unknown> }) => { records.push(data); return { id: `test-${records.length}`, ...data }; } }, auditLog: { create: async (data: unknown) => { audit.push(data); return {}; } } },
    requireApiUser: async (permission: string) => { assert.equal(permission, "media.write"); return denyPermission ? { error: Response.json({ error: "Forbidden" }, { status: 403 }) } : { user: { id: "isolated-user" } }; },
    checkUploadAntivirus: async () => infected ? { allowed: false, status: 422, error: "Malware blocked", result: { status: "infected", engine: "fixture" } } : { allowed: true, status: 200, result: { status: "clean", engine: "fixture" } },
  };
  const hook = registerHooks({ resolve(specifier, context, nextResolve) {
    const key = ({ "@/lib/db": "db", "@/lib/auth": "requireApiUser", "@/lib/upload-antivirus": "checkUploadAntivirus" } as Record<string, string>)[specifier];
    if (key) return { shortCircuit: true, url: pathToFileURL(path.join(root, "scripts/fixtures/image-upload-services.cjs")).href };
    if (specifier === "server-only") return { shortCircuit: true, url: pathToFileURL(path.join(root, "node_modules/next/dist/compiled/server-only/empty.js")).href };
    return nextResolve(specifier, context);
  } });
  try {
    const { POST } = await import("../app/api/admin/upload/route");
    const upload = async (request: Request) => {
      const response = await POST(request);
      assert.ok(response, "The upload handler must always return an HTTP response.");
      return response;
    };
    process.chdir(temporaryRoot);
    const image = await sharp({ create: { width: 1000, height: 600, channels: 4, background: "transparent" } }).png().toBuffer();
    const request = (bytes: Uint8Array, name: string, type: string, csrf = true, fileMode = false) => {
      const form = new FormData();
      form.set("file", new File([new Uint8Array(bytes)], name, { type }));
      form.set("context", "magnetic-power-bank-oem");
      form.set("alt", "OEM magnetic power bank front view");
      form.set("folder", "products");
      form.set("fileMode", String(fileMode));
      return new Request("http://localhost:3000/api/admin/upload", { method: "POST", headers: csrf ? { origin: "http://localhost:3000", cookie: "enercore_csrf_v2=isolated-check", "x-csrf-token": "isolated-check" } : {}, body: form });
    };
    const response = await upload(request(image, "手机图片.png", "image/png"));
    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.match(payload.data.path, /^\/uploads\/optimized\/magnetic-power-bank-oem-[a-f0-9]{12}\.webp$/);
    assert.equal(payload.data.mimeType, "image/webp");
    assert.equal(payload.data.alt, "OEM magnetic power bank front view");
    assert.deepEqual([payload.data.width, payload.data.height], [1000, 600]);
    assert.deepEqual(payload.optimization.responsiveWidths, [320, 640, 960]);
    const master = await readFile(path.join(temporaryRoot, "public", payload.data.path));
    assert.equal((await sharp(master).metadata()).format, "webp");
    assert.equal(payload.data.size, master.length);
    assert.equal((await readdir(path.join(temporaryRoot, "public/uploads/optimized"))).length, 4);
    assert.equal((await readdir(path.join(temporaryRoot, "storage/private/image-originals"))).length, 1);
    assert.equal(audit.length, 1);
    assert.equal((await upload(request(image, "copy.png", "image/png"))).status, 201, "A duplicate upload never overwrites its original or variants.");
    const beforeReject = records.length;
    assert.equal((await upload(request(image, "invalid.png", "image/png", false))).status, 403);
    denyPermission = true;
    assert.equal((await upload(request(image, "denied.png", "image/png"))).status, 403);
    denyPermission = false; infected = true;
    assert.equal((await upload(request(image, "malware.png", "image/png"))).status, 422);
    infected = false;
    assert.equal((await upload(request(Buffer.from("not a valid image"), "fake.png", "image/png"))).status, 400);
    assert.equal(records.length, beforeReject);
    const pdf = Buffer.from("%PDF-1.4\n% original certificate fixture\n%%EOF\n");
    const pdfResponse = await upload(request(pdf, "certificate.pdf", "application/pdf"));
    assert.equal(pdfResponse.status, 201);
    const document = (await pdfResponse.json()).data;
    assert.equal(document.mimeType, "application/pdf");
    assert.deepEqual(await readFile(path.join(temporaryRoot, "public", document.path)), pdf);
    const sourceResponse = await upload(request(image, "certificate-original.png", "image/png", true, true));
    assert.equal(sourceResponse.status, 201);
    const originalDocument = (await sourceResponse.json()).data;
    assert.equal(originalDocument.mimeType, "image/png");
    assert.deepEqual(await readFile(path.join(temporaryRoot, "public", originalDocument.path)), image, "Original-download image uploads retain their exact bytes, separately from optimized previews.");
    console.log("PASS: actual upload handler converts to WebP/English name, stores dimensions/ALT/variants, backs up originals privately, deduplicates files, retains PDF bytes, and enforces auth/CSRF/signature/antivirus. Temporary mock DB only.");
  } finally {
    process.chdir(root);
    hook.deregister(); delete scope.__imageUploadCheck;
    assert.equal(path.dirname(path.resolve(temporaryRoot)).toLowerCase(), path.resolve(tmpdir()).toLowerCase());
    assert.ok(path.basename(temporaryRoot).startsWith("shanze-image-upload-check-"));
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
