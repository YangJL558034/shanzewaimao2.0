"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertCircle, ArrowUpRight, Check, CheckCircle2, ChevronRight, Clock3, FileCheck2, FileSearch, Fingerprint, Loader2, RefreshCw, Shield, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { getFreshCsrfToken } from "@/lib/csrf-client";
import "./security-center.css";

type EngineStatus = { available: boolean; engine: string; label: string; detail: string };
type Finding = { path: string; type: "virus" | "integrity" | "unsafe_file" | "scan_error" | "config"; severity: "critical" | "high" | "medium" | "info"; detail: string };
type Scan = {
  id: string; scope?: "all" | "uploads" | "source"; status: "running" | "completed" | "partial" | "failed";
  startedAt: string; completedAt: string | null; totalFiles: number; scannedFiles: number; cleanFiles: number;
  infectedFiles: number; errorFiles: number; unscannedFiles?: number; changedFiles: number; findings: Finding[]; engine: EngineStatus;
};
type ConfigCheck = { key: string; label: string; status: "pass" | "warn" | "fail"; detail: string };
type SystemData = {
  status: string; database: string; databaseLatencyMs: number; node: string; environment: string; uptimeSeconds: number;
  memory: { rss: number; heapUsed: number }; disk: { free: number; total: number } | null; timestamp: string;
  permissions?: { canScan: boolean; canBaseline: boolean };
  security?: { engine: EngineStatus; latestScan: Scan | null; baseline: { createdAt: string | null; files: number }; recentScans: Scan[]; checks: ConfigCheck[] };
};
type Scope = "all" | "uploads" | "source";
type Filter = "all" | "virus" | "integrity" | "unsafe_file" | "scan_error";
const scanLabels = { running: "检查中", completed: "已完成", partial: "部分完成", failed: "检查失败" };
const typeLabels = { virus: "病毒威胁", integrity: "文件变更", unsafe_file: "可疑文件", scan_error: "检查异常", config: "配置风险" };
const severityLabels = { critical: "严重", high: "高风险", medium: "需关注", info: "提示" };
const scopeLabels = { all: "所有文件", uploads: "上传附件", source: "网站源码" };

function dateLabel(value?: string | null, compact = false) {
  if (!value) return "尚未检查";
  return new Date(value).toLocaleString("zh-CN", compact
    ? { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }
    : { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function bytesLabel(value: number) {
  return value >= 1024 ** 3 ? `${(value / 1024 ** 3).toFixed(1)} GB` : `${(value / 1024 ** 2).toFixed(1)} MB`;
}
async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || (response.status === 403 ? "当前账号没有此安全操作的权限，请联系管理员。" : "安全检查服务暂时不可用，请稍后重试。"));
  return payload as T;
}

export function SystemStatus() {
  const [data, setData] = useState<SystemData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [action, setAction] = useState<"scan" | "baseline" | null>(null);
  const [scope, setScope] = useState<Scope>("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [viewedScan, setViewedScan] = useState<Scan | null>(null);
  const [confirmBaseline, setConfirmBaseline] = useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const response = await fetch("/api/admin/system", { credentials: "same-origin", cache: "no-store" });
      setData(await readResponse<SystemData>(response)); setError("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "安全中心加载失败。"); }
    finally { if (manual) setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const running = data?.security?.latestScan?.status === "running";
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => { void load(); }, 3000);
    return () => window.clearInterval(timer);
  }, [load, running]);

  async function runScan() {
    setAction("scan"); setError(""); setNotice(""); setViewedScan(null); setFilter("all");
    try {
      const token = await getFreshCsrfToken();
      const response = await fetch("/api/admin/system/scans", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-csrf-token": token }, body: JSON.stringify({ scope }) });
      const payload = await readResponse<{ data: Scan }>(response);
      setData((current) => current?.security ? { ...current, security: { ...current.security, latestScan: payload.data } } : current);
      await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "无法启动文件检查。"); }
    finally { setAction(null); }
  }
  async function createBaseline() {
    setAction("baseline"); setError(""); setNotice("");
    try {
      const token = await getFreshCsrfToken();
      const response = await fetch("/api/admin/system/baseline", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", "x-csrf-token": token }, body: JSON.stringify({ confirm: true }) });
      const payload = await readResponse<{ ok: boolean; baseline: { files: number } }>(response);
      setConfirmBaseline(false); setNotice(`源码基线已建立，记录 ${payload.baseline.files.toLocaleString("zh-CN")} 个文件。后续检查将与此版本比较。`);
      await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "无法建立文件基线。"); }
    finally { setAction(null); }
  }

  if (!data) return <section className="sc-center sc-loading" role="status">
    {error ? <ShieldAlert size={32}/> : <Loader2 size={32} className="sc-spin"/>}<h2>{error ? "安全中心暂不可用" : "正在读取安全状态"}</h2>
    <p>{error || "连接检查引擎，读取文件与运行环境信息。"}</p>
    {error && <button className="sc-button" onClick={() => void load(true)} disabled={refreshing}><RefreshCw size={15}/>重新加载</button>}
  </section>;

  const security = data.security;
  const latest = security?.latestScan;
  const scan = viewedScan || latest;
  const engine = security?.engine;
  const avExecuted = !!scan?.engine?.available;
  const findings = (scan?.findings || []).filter((finding) => filter === "all" || finding.type === filter);
  const hasThreat = (scan?.infectedFiles || 0) > 0;
  const busy = action !== null || running;
  const progress = latest?.totalFiles ? Math.min(100, Math.round(latest.scannedFiles / latest.totalFiles * 100)) : 0;
  const configWarnings = (security?.checks || []).filter((check) => check.status !== "pass").length;
  const canScan = data.permissions?.canScan !== false;
  const canBaseline = data.permissions?.canBaseline !== false;

  return <div className="sc-center">
    <section className="sc-heading"><div className="sc-heading-copy"><span className="sc-heading-icon"><Shield size={23}/></span><div><h1>安全中心</h1><p>检查病毒威胁、网站文件变更与关键安全配置。</p></div></div>
      <div className="sc-heading-actions"><button className="sc-button" disabled={busy || !canBaseline || !security} title={!canBaseline ? "当前账号没有建立基线的权限" : undefined} onClick={() => setConfirmBaseline(true)}><Fingerprint size={16}/>{action === "baseline" ? "建立中…" : "建立文件基线"}</button>
        <button className="sc-button sc-button-primary" disabled={busy || !canScan || !security} title={!canScan ? "当前账号没有文件检查的权限" : undefined} onClick={runScan}>{busy && action !== "baseline" ? <Loader2 size={16} className="sc-spin"/> : <FileSearch size={16}/>}{running || action === "scan" ? "正在检查…" : "检查文件"}</button>
      </div></section>
    {error && <div className="sc-notice sc-notice-error" role="alert"><AlertCircle size={17}/><span>{error}</span><button aria-label="关闭错误提示" onClick={() => setError("")}><X size={15}/></button></div>}
    {notice && <div className="sc-notice sc-notice-success" role="status"><CheckCircle2 size={17}/><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice("")}><X size={15}/></button></div>}
    <div className="sc-stat-grid">
      <section className={`sc-card sc-stat ${hasThreat ? "sc-stat-danger" : ""}`}><span className={`sc-stat-icon ${hasThreat ? "sc-icon-danger" : "sc-icon-blue"}`}><ShieldAlert size={19}/></span><span className="sc-stat-label">病毒威胁</span>
        <strong>{scan ? avExecuted ? scan.infectedFiles.toLocaleString("zh-CN") : "未检测" : "待检测"}</strong><small>{scan ? avExecuted ? "本次病毒扫描发现数" : "杀毒引擎未连接，未执行病毒扫描" : "运行文件检查后查看结果"}</small></section>
      <section className="sc-card sc-stat"><span className="sc-stat-icon sc-icon-violet"><Fingerprint size={19}/></span><span className="sc-stat-label">文件变更</span><strong>{scan && security?.baseline.createdAt ? scan.changedFiles.toLocaleString("zh-CN") : "—"}</strong><small>{security?.baseline.createdAt ? `基线 · ${security.baseline.files.toLocaleString("zh-CN")} 个源码文件` : "建立可信基线后追踪变更"}</small></section>
      <section className="sc-card sc-stat"><span className="sc-stat-icon sc-icon-blue"><FileCheck2 size={19}/></span><span className="sc-stat-label">已检查文件</span><strong>{scan ? scan.scannedFiles.toLocaleString("zh-CN") : "—"}<span className="sc-stat-denominator">{scan ? ` / ${scan.totalFiles.toLocaleString("zh-CN")}` : ""}</span></strong><small>{scan ? `${scan.errorFiles} 个异常 · ${scan.unscannedFiles || 0} 个未覆盖` : "上传附件与网站源码"}</small></section>
      <section className="sc-card sc-stat"><span className="sc-stat-icon sc-icon-slate"><Activity size={19}/></span><span className="sc-stat-label">运行状态</span><strong className="sc-stat-word">{data.status === "healthy" && data.database === "connected" ? "正常运行" : "需要检查"}</strong><small>{configWarnings ? `${configWarnings} 项安全配置需要关注` : "查看下方安全配置检查"}</small></section>
    </div>
    <div className="sc-summary-grid">
      <section className="sc-card sc-engine"><div className="sc-section-heading"><div><h2>文件检查</h2><p>按需选择范围，检查记录自动保存。</p></div><span className={`sc-badge ${engine?.available ? "sc-badge-good" : "sc-badge-warn"}`}>{engine?.available ? "引擎已连接" : "引擎未连接"}</span></div>
        <div className="sc-engine-name"><span className="sc-engine-icon"><ShieldCheck size={22}/></span><div><strong>{engine?.label || "病毒扫描引擎"}</strong><p>{engine?.detail || "尚未获取引擎状态。"}</p></div></div>
        {!engine?.available && <div className="sc-engine-help">启用 ClamAV 并配置连接后可执行病毒扫描。当前仍可检查文件完整性与可疑文件。<a href="https://github.com/Cisco-Talos/clamav" target="_blank" rel="noreferrer">查看 ClamAV 开源项目 <ArrowUpRight size={13}/></a></div>}
        <div className="sc-scan-controls"><label htmlFor="security-scope">检查范围</label><select id="security-scope" value={scope} onChange={(event) => setScope(event.target.value as Scope)} disabled={busy || !canScan}><option value="all">所有文件</option><option value="uploads">上传附件</option><option value="source">网站源码</option></select><button className="sc-icon-button" aria-label="刷新检查状态" title="刷新检查状态" onClick={() => void load(true)} disabled={refreshing}><RefreshCw size={16} className={refreshing ? "sc-spin" : ""}/></button></div>
        {running && <div className="sc-progress" role="status"><div><span>正在检查{scopeLabels[latest?.scope || "all"]}</span><strong>{progress}%</strong></div><progress value={latest?.scannedFiles || 0} max={latest?.totalFiles || 1}/><small>已检查 {latest?.scannedFiles || 0} / {latest?.totalFiles || 0} 个文件，页面自动更新。</small></div>}
        <div className="sc-baseline-note"><Fingerprint size={15}/><span>{security?.baseline.createdAt ? `源码基线更新于 ${dateLabel(security.baseline.createdAt)}` : "尚未建立文件基线，暂无法判断源码是否被修改。"}</span></div>
      </section>
      <section className="sc-card sc-checks"><div className="sc-section-heading"><div><h2>安全配置</h2><p>根据当前部署环境检查。</p></div><span className="sc-quiet-count">{security?.checks.length || 0} 项</span></div>
        {security?.checks.length ? <ul>{security.checks.map((check) => <li key={check.key}><span className={`sc-check-icon sc-check-${check.status}`}>{check.status === "pass" ? <Check size={14}/> : <AlertCircle size={14}/>}</span><div><strong>{check.label}</strong><p>{check.detail}</p></div><span className={`sc-badge ${check.status === "pass" ? "sc-badge-good" : check.status === "fail" ? "sc-badge-danger" : "sc-badge-warn"}`}>{check.status === "pass" ? "通过" : check.status === "fail" ? "风险" : "关注"}</span></li>)}</ul> : <p className="sc-empty-inline">安全配置检查结果暂未加载。</p>}
      </section>
    </div>
    <section className="sc-card sc-findings"><div className="sc-section-heading"><div><h2>检查结果 <span className="sc-quiet-count">{scan?.findings.length || 0}</span></h2><p>{viewedScan ? `历史记录 · ${dateLabel(viewedScan.startedAt)}` : latest ? `最近检查 · ${dateLabel(latest.startedAt)}` : "尚未运行文件检查"}</p></div><div className="sc-result-controls">{viewedScan && <button className="sc-text-button" onClick={() => setViewedScan(null)}>返回最新结果</button>}<select aria-label="筛选检查结果" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}><option value="all">全部结果</option><option value="virus">病毒威胁</option><option value="integrity">文件变更</option><option value="unsafe_file">可疑文件</option><option value="scan_error">检查异常</option></select></div></div>
      {findings.length ? <div className="sc-table-wrap"><table><thead><tr><th>风险等级</th><th>检查项目</th><th>文件 / 位置</th><th>详情</th></tr></thead><tbody>{findings.map((finding, index) => <tr key={`${finding.path}-${finding.type}-${index}`}><td><span className={`sc-badge sc-severity-${finding.severity}`}>{severityLabels[finding.severity]}</span></td><td className="sc-type-cell">{typeLabels[finding.type]}</td><td className="sc-path-cell"><code>{finding.path}</code></td><td className="sc-detail-cell">{finding.detail}</td></tr>)}</tbody></table></div>
        : <div className="sc-results-empty">{scan && scan.status !== "running" ? <FileCheck2 size={27}/> : <FileSearch size={27}/>}<strong>{filter !== "all" ? "没有符合筛选条件的结果" : scan?.status === "running" ? "正在检查，请稍候" : !scan ? "开始一次文件检查" : scan.status === "failed" ? "本次检查未能完成" : "本次未记录风险项"}</strong><p>{!scan ? "点击「检查文件」，查看病毒扫描与文件安全结果。" : scan.status === "running" ? "检查结果会自动更新，无需刷新页面。" : !avExecuted ? "病毒扫描未执行，请连接杀毒引擎后再次检查。" : scan.status === "partial" || scan.errorFiles > 0 || (scan.unscannedFiles || 0) > 0 ? "检查未覆盖所有文件，请查看引擎状态及检查记录。" : "检查结果只覆盖本次扫描范围。"}</p></div>}
      {scan && scan.status !== "running" && (scan.unscannedFiles || 0) > 0 && <div className="sc-coverage-note"><AlertCircle size={14}/><span>{scan.unscannedFiles} 个文件未完成病毒扫描。本次结果不代表所有文件安全。</span></div>}
    </section>
    <div className="sc-bottom-grid">
      <section className="sc-card sc-history"><div className="sc-section-heading"><div><h2>最近检查</h2><p>保留检查记录，方便追溯。</p></div><Clock3 size={17} className="sc-muted-icon"/></div>
        {security?.recentScans.length ? <ul>{security.recentScans.slice(0, 5).map((item) => <li key={item.id}><button onClick={() => { setViewedScan(item); setFilter("all"); }}><span className="sc-history-icon"><FileSearch size={16}/></span><span className="sc-history-copy"><strong>{dateLabel(item.startedAt)}{item.scope ? ` · ${scopeLabels[item.scope]}` : ""}</strong><small>{item.scannedFiles} 个文件 · {item.engine.available ? `${item.infectedFiles} 个病毒威胁` : "病毒未检测"} · {item.changedFiles} 个变更</small></span><span className={`sc-badge ${item.status === "completed" ? "sc-badge-neutral" : item.status === "failed" ? "sc-badge-danger" : "sc-badge-warn"}`}>{scanLabels[item.status]}</span><ChevronRight size={16}/></button></li>)}</ul> : <p className="sc-empty-inline">运行检查后，记录将显示在这里。</p>}
      </section>
      <section className="sc-card sc-runtime"><div className="sc-section-heading"><div><h2>运行环境</h2><p>最近读取 · {dateLabel(data.timestamp, true)}</p></div><Activity size={17} className="sc-muted-icon"/></div><dl>
        <div><dt>数据库</dt><dd>{data.database === "connected" ? `${data.databaseLatencyMs} ms · 已连接` : "连接异常"}</dd></div><div><dt>运行环境</dt><dd>{data.environment === "production" ? "生产环境" : data.environment === "development" ? "开发环境" : data.environment}</dd></div><div><dt>Node.js</dt><dd>{data.node}</dd></div><div><dt>运行时长</dt><dd>{Math.floor(data.uptimeSeconds / 3600)} 小时 {Math.floor(data.uptimeSeconds / 60) % 60} 分钟</dd></div><div><dt>内存占用</dt><dd>{data.memory ? bytesLabel(data.memory.rss) : "—"}</dd></div><div><dt>磁盘剩余</dt><dd>{data.disk ? bytesLabel(data.disk.free) : "未获取"}</dd></div>
      </dl></section>
    </div>
    {confirmBaseline && <div className="sc-modal-backdrop" onClick={() => action === null && setConfirmBaseline(false)}><section className="sc-modal" role="dialog" aria-modal="true" aria-labelledby="baseline-title" onClick={(event) => event.stopPropagation()}><span className="sc-modal-icon"><Fingerprint size={25}/></span><h2 id="baseline-title">建立可信源码基线</h2><p>保存当前网站源码的文件指纹，用于后续检测新增、删除和修改的文件。上传附件不纳入可信基线。</p><div className="sc-modal-warning"><AlertCircle size={18}/><p>请先确认当前源码可信。新基线会替换原基线，当前源码将被接受为正常版本；建立基线不会扫描或清除病毒。</p></div>{error && <p className="sc-modal-error" role="alert">{error}</p>}<div className="sc-modal-actions"><button className="sc-button" disabled={action !== null} onClick={() => setConfirmBaseline(false)}>取消</button><button className="sc-button sc-button-primary" disabled={action !== null} onClick={createBaseline}>{action === "baseline" && <Loader2 size={15} className="sc-spin"/>}确认建立基线</button></div></section></div>}
  </div>;
}
