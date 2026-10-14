import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, lstat, mkdtemp, readFile, readdir, realpath, rmdir, unlink, writeFile } from "node:fs/promises";
import { createConnection, type Socket } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

export type AntivirusStatus = {
  available: boolean;
  engine: string;
  label: string;
  detail: string;
  version?: string;
  signatures?: string;
};

export type AntivirusResult = {
  status: "clean" | "infected" | "unavailable" | "error" | "skipped";
  engine: string;
  detail: string;
  signature?: string;
};

type EngineMode = "auto" | "clamd" | "clamscan" | "defender" | "off";
type Engine = AntivirusStatus & { executable?: string };
type CommandResult = { code: number | null; output: string; timedOut: boolean; error?: string };

const OUTPUT_LIMIT = 32 * 1024;
const CHUNK_SIZE = 64 * 1024;
let cachedEngine: { key: string; expires: number; value: Promise<Engine> } | undefined;

function boundedNumber(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const number = Number(value);
  return Number.isFinite(number) && value?.trim() ? Math.max(minimum, Math.min(maximum, Math.floor(number))) : fallback;
}

function settings() {
  const rawMode = (process.env.ANTIVIRUS_ENGINE || "auto").toLowerCase();
  const mode: EngineMode = ["auto", "clamd", "clamscan", "defender", "off"].includes(rawMode) ? rawMode as EngineMode : "off";
  return {
    mode,
    invalidMode: rawMode !== mode,
    host: process.env.CLAMAV_HOST?.trim() || "127.0.0.1",
    port: boundedNumber(process.env.CLAMAV_PORT, 3310, 1, 65535),
    maxBytes: boundedNumber(process.env.ANTIVIRUS_MAX_BYTES, 40 * 1024 * 1024, 1024, 100 * 1024 * 1024),
    timeout: boundedNumber(process.env.ANTIVIRUS_TIMEOUT_MS, 15_000, 1000, 45_000),
  };
}

function concise(value: string) {
  return value.replace(/\0/g, "").replace(/[\r\n]+/g, " ").trim().slice(0, 500);
}

function writeSocket(socket: Socket, buffer: Buffer) {
  return new Promise<void>((resolve, reject) => {
    socket.write(buffer, (error) => error ? reject(error) : resolve());
  });
}

/** ClamAV's z framing + INSTREAM keeps uploaded contents off the daemon filesystem. */
function clamdRequest(command: "PING" | "VERSIONCOMMANDS" | "VERSION" | "INSTREAM", buffer?: Buffer, timeout = 1200) {
  const config = settings();
  return new Promise<string>((resolve, reject) => {
    const socket = createConnection({ host: config.host, port: config.port });
    let response = Buffer.alloc(0);
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve(response.toString("utf8").replace(/\0[\s\S]*$/, "").trim());
    };
    const timer = setTimeout(() => finish(new Error("ClamAV 扫描超时")), timeout);
    timer.unref();
    socket.on("error", (error) => finish(error));
    socket.on("data", (chunk: Buffer) => {
      if (response.length + chunk.length > OUTPUT_LIMIT) {
        finish(new Error("ClamAV 返回数据超出限制"));
        return;
      }
      response = Buffer.concat([response, chunk]);
      if (response.includes(0)) finish();
    });
    socket.on("end", () => response.length ? finish() : finish(new Error("ClamAV 未返回扫描结果")));
    socket.on("connect", async () => {
      try {
        await writeSocket(socket, Buffer.from(`z${command}\0`));
        if (command !== "INSTREAM" || !buffer) return;
        for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
          if (settled) return;
          const chunk = buffer.subarray(offset, offset + CHUNK_SIZE);
          const length = Buffer.alloc(4);
          length.writeUInt32BE(chunk.length);
          await writeSocket(socket, length);
          await writeSocket(socket, chunk);
        }
        if (!settled) await writeSocket(socket, Buffer.alloc(4));
      } catch (error) {
        finish(error instanceof Error ? error : new Error("ClamAV 数据发送失败"));
      }
    });
  });
}

/** Fixed executables + argument arrays only. Never pass a filename through a shell. */
function runCommand(executable: string, args: string[], timeout: number): Promise<CommandResult> {
  return new Promise((resolve) => {
    let output = "";
    let timedOut = false;
    let settled = false;
    const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const finish = (code: number | null, error?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, output, timedOut, error });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      finish(null, "病毒扫描超时");
    }, timeout);
    timer.unref();
    const collect = (chunk: Buffer) => { output = (output + chunk.toString("utf8")).slice(0, OUTPUT_LIMIT); };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", (error) => finish(null, error.message));
    child.on("close", (code) => finish(code));
  });
}

async function executableExists(candidate: string) {
  try {
    const info = await lstat(candidate);
    if (!info.isFile()) return false;
    await access(candidate, process.platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findClamscan() {
  const configured = process.env.CLAMAV_BINARY?.trim();
  const name = process.platform === "win32" ? "clamscan.exe" : "clamscan";
  if (configured) {
    // Only a server-side environment value can select the ClamAV binary, never an HTTP parameter.
    if (!path.isAbsolute(configured) || !/^clamscan(?:\.exe)?$/i.test(path.basename(configured))) return undefined;
    return await executableExists(configured) ? configured : undefined;
  }
  for (const directory of (process.env.PATH || "").split(path.delimiter)) {
    if (!directory || !path.isAbsolute(directory.replace(/^"|"$/g, ""))) continue;
    const candidate = path.join(directory.replace(/^"|"$/g, ""), name);
    if (await executableExists(candidate)) return candidate;
  }
  return undefined;
}

async function findDefender() {
  if (process.platform !== "win32") return undefined;
  const platformDirectory = path.join(process.env.ProgramData || "C:\\ProgramData", "Microsoft", "Windows Defender", "Platform");
  try {
    const versions = (await readdir(platformDirectory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && /^\d[\d.-]*$/.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const version of versions) {
      const executable = path.join(platformDirectory, version, "MpCmdRun.exe");
      if (await executableExists(executable)) return executable;
    }
  } catch { /* Defender isn't present on every Windows host. */ }
  const executable = path.join(process.env.ProgramFiles || "C:\\Program Files", "Windows Defender", "MpCmdRun.exe");
  return await executableExists(executable) ? executable : undefined;
}

async function inspectDefender(): Promise<Engine | undefined> {
  const executable = await findDefender();
  if (!executable) return undefined;
  const powershell = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const command = "$ErrorActionPreference='Stop'; Get-MpComputerStatus | Select-Object AMServiceEnabled,AntivirusEnabled,AMProductVersion,AntivirusSignatureVersion | ConvertTo-Json -Compress";
  const result = await runCommand(powershell, ["-NoProfile", "-NonInteractive", "-Command", command], 5000);
  if (result.code !== 0 || result.error) {
    return { available: false, engine: "defender", label: "Microsoft Defender", detail: "已安装 Defender，但当前进程无法读取服务状态；请检查服务及运行权限。" };
  }
  try {
    const status = JSON.parse(result.output.trim()) as { AMServiceEnabled?: boolean; AntivirusEnabled?: boolean; AMProductVersion?: string; AntivirusSignatureVersion?: string };
    const available = status.AMServiceEnabled === true && status.AntivirusEnabled === true && Boolean(status.AntivirusSignatureVersion);
    return {
      available, engine: "defender", label: "Microsoft Defender", executable,
      detail: available ? "Defender 已启用；执行单文件自定义扫描，仅检测，不删除或隔离文件。" : "Defender 服务未启用或缺少病毒库；尚不能执行病毒检测。",
      version: status.AMProductVersion, signatures: status.AntivirusSignatureVersion || undefined,
    };
  } catch {
    return { available: false, engine: "defender", label: "Microsoft Defender", detail: "无法读取 Defender 服务状态；尚不能执行病毒检测。" };
  }
}

async function discoverEngine(): Promise<Engine> {
  const config = settings();
  const failures: string[] = [];
  if (config.mode === "off") {
    return { available: false, engine: "none", label: "未接入病毒引擎", detail: config.invalidMode ? "ANTIVIRUS_ENGINE 配置无效。" : "病毒引擎已禁用。" };
  }
  if (config.mode === "auto" || config.mode === "clamd") {
    try {
      if (await clamdRequest("PING") !== "PONG") throw new Error("ClamAV PING 响应异常");
      let version = "";
      try {
        const capabilities = await clamdRequest("VERSIONCOMMANDS");
        if (capabilities.includes("COMMANDS:") && !/\bINSTREAM\b/.test(capabilities)) throw new Error("ClamAV 未启用 INSTREAM");
        if (capabilities.startsWith("ClamAV")) version = concise(capabilities.split("COMMANDS:")[0]);
        else version = concise(await clamdRequest("VERSION"));
      } catch (error) {
        if (error instanceof Error && error.message.includes("未启用")) throw error;
      }
      return { available: true, engine: "clamd", label: "ClamAV / ClamD", detail: "ClamAV 守护进程已连接；通过 INSTREAM 进行病毒库扫描，不自动处理文件。", version: version || undefined };
    } catch {
      failures.push("ClamAV 守护进程未连接");
    }
  }
  if (config.mode === "auto" || config.mode === "clamscan") {
    const executable = await findClamscan();
    if (executable) {
      const result = await runCommand(executable, ["--version"], 5000);
      const version = concise(result.output);
      if (result.code === 0 && /^ClamAV\b/.test(version) && /\/\d+\//.test(version)) {
        return { available: true, engine: "clamscan", label: "ClamAV / clamscan", executable, detail: "ClamAV 命令行引擎与病毒库已就绪；仅检测，不删除或移动文件。", version };
      }
      failures.push("ClamAV 命令行引擎或病毒库尚未就绪");
    } else failures.push("未找到 clamscan 命令行引擎");
  }
  if (config.mode === "auto" || config.mode === "defender") {
    const defender = await inspectDefender();
    if (defender?.available || config.mode === "defender") return defender || { available: false, engine: "defender", label: "Microsoft Defender", detail: "此服务器未安装可用的 Microsoft Defender。" };
    if (defender) failures.push(defender.detail);
  }
  return { available: false, engine: "none", label: "未接入病毒引擎", detail: `${failures.map((failure) => failure.replace(/[。；]+$/, "")).join("；")}。请在服务器配置 ClamAV 与病毒库。` };
}

async function getEngine() {
  const key = JSON.stringify([settings().mode, process.env.CLAMAV_HOST, process.env.CLAMAV_PORT, process.env.CLAMAV_BINARY]);
  if (!cachedEngine || cachedEngine.key !== key || cachedEngine.expires < Date.now()) {
    cachedEngine = { key, expires: Date.now() + 30_000, value: discoverEngine() };
  }
  return cachedEngine.value;
}

export async function getAntivirusStatus(): Promise<AntivirusStatus> {
  const { executable: _executable, ...status } = await getEngine();
  return status;
}

function clamdResult(response: string): AntivirusResult {
  const normalized = response.trim();
  if (/^stream: OK$/.test(normalized)) return { status: "clean", engine: "clamd", detail: "ClamAV 病毒检测完成，未发现恶意软件。" };
  const signature = normalized.match(/^stream: (.+) FOUND$/)?.[1];
  if (signature) return { status: "infected", engine: "clamd", signature: concise(signature), detail: "ClamAV 检测到恶意软件；文件未被自动删除或移动。" };
  return { status: "error", engine: "clamd", detail: `ClamAV 未完成检测：${concise(normalized) || "未知响应"}` };
}

async function scanWithCommand(file: string, engine: Engine): Promise<AntivirusResult> {
  if (!engine.executable) return { status: "unavailable", engine: engine.engine, detail: "病毒引擎不可用。" };
  const config = settings();
  if (engine.engine === "clamscan") {
    const result = await runCommand(engine.executable, ["--no-summary", "--", file], config.timeout);
    if (result.timedOut || result.error) return { status: "error", engine: engine.engine, detail: result.timedOut ? "ClamAV 扫描超时，未完成检测。" : "ClamAV 扫描无法启动，请检查服务器运行权限。" };
    if (result.code === 0 && /:\s+OK\s*(?:\r?\n|$)/.test(result.output)) return { status: "clean", engine: engine.engine, detail: "ClamAV 病毒检测完成，未发现恶意软件。" };
    if (result.code === 1) {
      const signature = result.output.match(/:\s+(.+?) FOUND(?:\r?\n|$)/)?.[1];
      return { status: "infected", engine: engine.engine, signature: signature ? concise(signature) : undefined, detail: "ClamAV 检测到恶意软件；文件未被自动删除或移动。" };
    }
    return { status: "error", engine: engine.engine, detail: result.code === 0 ? "ClamAV 未返回文件已扫描的确认，无法判定安全。" : "ClamAV 扫描失败，请检查病毒库、文件权限与扫描限制。" };
  }
  // Defender exit 2 can mean either malware OR an error, so never infer infection from it alone.
  const result = await runCommand(engine.executable, ["-Scan", "-ScanType", "3", "-File", file, "-DisableRemediation"], config.timeout);
  if (result.timedOut || result.error) return { status: "error", engine: engine.engine, detail: result.timedOut ? "Defender 扫描超时，未完成检测。" : "Defender 扫描无法启动，请检查服务与运行权限。" };
  if (result.code === 0) return { status: "clean", engine: engine.engine, detail: "Defender 病毒检测完成，未发现恶意软件。" };
  const signature = result.output.match(/(?:Threat\s+(?:Name|name)|威胁名称)\s*[:：]\s*([^\r\n]+)/)?.[1];
  if (signature) return { status: "infected", engine: engine.engine, signature: concise(signature), detail: "Defender 检测到恶意软件；扫描已禁用自动修复。" };
  return { status: "error", engine: engine.engine, detail: "Defender 未完成检测或报告待处理威胁，请检查服务器扫描权限与安全日志。" };
}

export async function scanBufferForViruses(buffer: Buffer, fileName = "upload.bin"): Promise<AntivirusResult> {
  const config = settings();
  if (buffer.length > config.maxBytes) return { status: "skipped", engine: "none", detail: `文件超过病毒扫描大小限制（${Math.floor(config.maxBytes / 1024 / 1024)} MB），尚未执行病毒检测。` };
  const engine = await getEngine();
  if (!engine.available) return { status: "unavailable", engine: engine.engine, detail: engine.detail };
  if (engine.engine === "clamd") {
    try { return clamdResult(await clamdRequest("INSTREAM", buffer, config.timeout)); }
    catch { return { status: "error", engine: engine.engine, detail: "ClamAV 连接中断或扫描超时，未完成病毒检测。" }; }
  }
  let temporaryDirectory: string | undefined;
  let temporaryFile: string | undefined;
  try {
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), "shanze-antivirus-"));
    const extension = path.extname(path.basename(fileName)).replace(/[^.a-zA-Z0-9]/g, "").slice(0, 16) || ".bin";
    temporaryFile = path.join(temporaryDirectory, `sample${extension}`);
    await writeFile(temporaryFile, buffer, { flag: "wx", mode: 0o600 });
    return await scanWithCommand(temporaryFile, engine);
  } catch {
    return { status: "error", engine: engine.engine, detail: "无法为病毒检测创建临时文件。" };
  } finally {
    // Only our exact unique temporary sample and empty directory are removed, never source files.
    if (temporaryFile) await unlink(temporaryFile).catch(() => undefined);
    if (temporaryDirectory) await rmdir(temporaryDirectory).catch(() => undefined);
  }
}

export async function scanFileForViruses(absPath: string): Promise<AntivirusResult> {
  if (!path.isAbsolute(absPath)) return { status: "error", engine: "none", detail: "扫描需要绝对文件路径。" };
  try {
    const info = await lstat(absPath);
    if (!info.isFile() || info.isSymbolicLink()) return { status: "skipped", engine: "none", detail: "仅扫描普通文件，不扫描目录或符号链接。" };
    if (info.size > settings().maxBytes) return { status: "skipped", engine: "none", detail: "文件超过病毒扫描大小限制，尚未执行病毒检测。" };
    const resolved = await realpath(absPath);
    const engine = await getEngine();
    if (!engine.available) return { status: "unavailable", engine: engine.engine, detail: engine.detail };
    if (engine.engine === "clamd") return scanBufferForViruses(await readFile(resolved), path.basename(resolved));
    return scanWithCommand(resolved, engine);
  } catch {
    return { status: "error", engine: "none", detail: "文件不存在或无法读取，尚未执行病毒检测。" };
  }
}
