import "server-only";
import { db } from "@/lib/db";
import { scanBufferForViruses } from "@/lib/antivirus";

/** Check before persisting untrusted files; detection never deletes existing files. */
export async function checkUploadAntivirus(buffer: Buffer, fileName: string, userId?: string) {
  const result = await scanBufferForViruses(buffer, fileName);
  if (result.status === "infected") {
    await db.auditLog.create({ data: { userId, action: "UPLOAD_MALWARE_BLOCKED", entityType: "security", afterJson: JSON.stringify({ fileName: fileName.slice(0, 200), engine: result.engine, status: result.status, detail: result.detail }) } });
    return { allowed: false, status: 422, error: "文件被病毒引擎标记为风险文件，上传已阻止。", result };
  }
  const strict = process.env.ANTIVIRUS_REQUIRE_CLEAN === "true";
  if (strict && result.status !== "clean") return { allowed: false, status: 503, error: "病毒检测暂不可用或文件未完成检测，请联系管理员后重试。", result };
  return { allowed: true, status: 200, result };
}
