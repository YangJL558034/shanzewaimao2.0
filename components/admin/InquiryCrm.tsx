"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  Mail,
  MessageSquarePlus,
  Phone,
  RefreshCw,
  Search,
  UserRound,
  X,
} from "lucide-react";

import { getFreshCsrfToken } from "@/lib/csrf-client";

type Admin = { id: string; name: string };
type Note = {
  id: string;
  type: string;
  content: string;
  result?: string | null;
  statusAfter?: string | null;
  contactedAt?: string | null;
  nextActionAt?: string | null;
  createdAt: string;
  user?: Admin;
};
type Assignment = {
  id: string;
  reason?: string | null;
  createdAt: string;
  fromAssignee?: Admin | null;
  toAssignee?: Admin | null;
  assignedBy?: Admin | null;
};
type Attachment = { id: string; fileName: string; size: number };
type Inquiry = {
  id: string;
  referenceNo: string;
  fullName: string;
  companyName: string;
  email: string;
  phone?: string | null;
  country: string;
  productInterest: string;
  message: string;
  source: string;
  status: string;
  priority: string;
  assignedToId?: string | null;
  assignedTo?: (Admin & { email?: string }) | null;
  lastContactAt?: string | null;
  nextFollowUpAt?: string | null;
  createdAt: string;
  notes?: Note[];
  assignmentHistory?: Assignment[];
  attachments?: Attachment[];
};

const statuses = ["NEW", "ASSIGNED", "CONTACTED", "QUALIFIED", "QUOTED", "WON", "LOST", "SPAM"];
const statusLabels: Record<string, string> = {
  NEW: "新询盘",
  ASSIGNED: "已分配",
  CONTACTED: "已联系",
  QUALIFIED: "需求确认",
  QUOTED: "已报价",
  WON: "已成交",
  LOST: "未成交",
  SPAM: "垃圾询盘",
};
const priorityLabels: Record<string, string> = { low: "低", normal: "普通", high: "高", urgent: "紧急" };
const activityLabels: Record<string, string> = { note: "内部备注", call: "电话", email: "邮件", meeting: "会议", quote: "报价", task: "任务" };

function localInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function isOpen(status: string) {
  return !["WON", "LOST", "SPAM"].includes(status);
}

export function InquiryCrm() {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [priority, setPriority] = useState("ALL");
  const [owner, setOwner] = useState("ALL");
  const [assignee, setAssignee] = useState("");
  const [handoffReason, setHandoffReason] = useState("");
  const [noteType, setNoteType] = useState("call");
  const [note, setNote] = useState("");
  const [result, setResult] = useState("");
  const [statusAfter, setStatusAfter] = useState("CONTACTED");
  const [contactedAt, setContactedAt] = useState(localInputValue());
  const [nextActionAt, setNextActionAt] = useState("");

  const load = useCallback(async (selectedId?: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/inquiries", { credentials: "same-origin", cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "询盘加载失败");
      const nextRows = payload.data as Inquiry[];
      setRows(nextRows);
      setAdmins((payload.relations?.admins || []) as Admin[]);
      if (selectedId) setSelected(nextRows.find((item) => item.id === selectedId) || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "询盘加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selected) return;
    setAssignee(selected.assignedToId || "");
    setStatusAfter(selected.status === "NEW" || selected.status === "ASSIGNED" ? "CONTACTED" : selected.status);
    setHandoffReason("");
    setNote("");
    setResult("");
    setContactedAt(localInputValue());
    setNextActionAt(selected.nextFollowUpAt ? localInputValue(new Date(selected.nextFollowUpAt)) : "");
  }, [selected?.id]);

  const filtered = useMemo(() => rows.filter((item) => {
    const text = `${item.referenceNo} ${item.fullName} ${item.companyName} ${item.email} ${item.productInterest}`.toLowerCase();
    return text.includes(query.toLowerCase())
      && (status === "ALL" || item.status === status)
      && (priority === "ALL" || item.priority === priority)
      && (owner === "ALL" || (owner === "UNASSIGNED" ? !item.assignedToId : item.assignedToId === owner));
  }), [rows, query, status, priority, owner]);

  const now = new Date();
  const summary = {
    new: rows.filter((item) => item.status === "NEW").length,
    active: rows.filter((item) => isOpen(item.status)).length,
    due: rows.filter((item) => item.nextFollowUpAt && isOpen(item.status) && new Date(item.nextFollowUpAt) <= now).length,
    won: rows.filter((item) => item.status === "WON").length,
  };

  async function mutate(url: string, body: unknown, method = "POST") {
    setBusy(true);
    setError("");
    try {
      const csrf = await getFreshCsrfToken();
      const response = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "操作失败");
      if (selected) await load(selected.id);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handoff() {
    if (!selected) return;
    const ok = await mutate(`/api/admin/inquiries/${selected.id}/assign`, { toAssigneeId: assignee || null, reason: handoffReason });
    if (ok) setHandoffReason("");
  }

  async function addFollowUp() {
    if (!selected || note.trim().length < 2) {
      setError("请填写本次跟进内容");
      return;
    }
    const ok = await mutate(`/api/admin/inquiries/${selected.id}/notes`, {
      content: note,
      type: noteType,
      result,
      statusAfter,
      contactedAt: new Date(contactedAt).toISOString(),
      nextActionAt: nextActionAt ? new Date(nextActionAt).toISOString() : null,
    });
    if (ok) { setNote(""); setResult(""); }
  }

  async function updatePipeline(field: "status" | "priority", value: string) {
    if (!selected) return;
    await mutate(`/api/admin/inquiries/${selected.id}`, { [field]: value }, "PUT");
  }

  const timeline = selected ? [
    ...(selected.notes || []).map((item) => ({ kind: "note" as const, at: item.createdAt, item })),
    ...(selected.assignmentHistory || []).map((item) => ({ kind: "assignment" as const, at: item.createdAt, item })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()) : [];

  return <>
    <div className="crm-summary-grid">
      <div className="admin-panel"><MessageSquarePlus/><span>新询盘<strong>{summary.new}</strong></span></div>
      <div className="admin-panel"><Clock3/><span>进行中<strong>{summary.active}</strong></span></div>
      <div className="admin-panel is-warning"><CalendarClock/><span>到期跟进<strong>{summary.due}</strong></span></div>
      <div className="admin-panel is-success"><CheckCircle2/><span>已成交<strong>{summary.won}</strong></span></div>
    </div>

    <section className="admin-panel crm-list-panel">
      <div className="admin-panel-head crm-list-head"><div><h2>询盘 CRM</h2><p>客户分配、销售交接、阶段管理和完整跟进记录</p></div><button className="icon-btn" onClick={() => load()} aria-label="刷新"><RefreshCw size={15}/></button></div>
      <div className="crm-filters">
        <label className="crm-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索编号、客户、公司、邮箱或产品" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">全部阶段</option>{statuses.map((value) => <option value={value} key={value}>{statusLabels[value]}</option>)}</select>
        <select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="ALL">全部负责人</option><option value="UNASSIGNED">待分配</option>{admins.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
        <select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="ALL">全部优先级</option>{Object.entries(priorityLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
      </div>
      {error && !selected && <div className="form-status error m-4">{error}</div>}
      <div className="admin-table-wrap"><table className="admin-table crm-table"><thead><tr><th>询盘/客户</th><th>意向产品</th><th>负责人</th><th>阶段</th><th>优先级</th><th>下次跟进</th><th>提交时间</th><th>操作</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={8} className="crm-empty"><RefreshCw className="animate-spin"/>正在加载真实询盘…</td></tr> : filtered.length ? filtered.map((item) => {
          const overdue = item.nextFollowUpAt && isOpen(item.status) && new Date(item.nextFollowUpAt) <= now;
          return <tr key={item.id} className={overdue ? "is-overdue" : ""}>
            <td><strong>{item.companyName}</strong><small>{item.fullName} · {item.referenceNo}</small></td>
            <td>{item.productInterest}</td>
            <td>{item.assignedTo?.name || <span className="crm-unassigned">待分配</span>}</td>
            <td><span className={`status-pill ${item.status}`}>{statusLabels[item.status]}</span></td>
            <td><span className={`priority-pill ${item.priority}`}>{priorityLabels[item.priority] || item.priority}</span></td>
            <td className={overdue ? "crm-due" : ""}>{formatDate(item.nextFollowUpAt)}{overdue && <small>已到期</small>}</td>
            <td>{formatDate(item.createdAt)}</td>
            <td><button className="btn btn-outline btn-sm" onClick={() => setSelected(item)}>打开工作台</button></td>
          </tr>;
        }) : <tr><td colSpan={8} className="crm-empty">没有符合筛选条件的询盘</td></tr>}
      </tbody></table></div>
    </section>

    {selected && <div className="modal-backdrop crm-modal-backdrop" role="dialog" aria-modal="true" aria-label="询盘销售工作台"><section className="admin-modal crm-modal">
      <header className="modal-head crm-modal-head"><div><small>{selected.referenceNo}</small><h2>{selected.companyName}</h2><p>{selected.fullName} · {selected.country} · {selected.productInterest}</p></div><button className="icon-btn" onClick={() => setSelected(null)} aria-label="关闭"><X size={17}/></button></header>
      <div className="modal-body crm-modal-body">
        {error && <div className="form-status error">{error}</div>}
        <div className="crm-detail-grid">
          <div className="crm-main-column">
            <section className="crm-card"><h3>客户与需求</h3><div className="crm-contact-grid">
              <a href={`mailto:${selected.email}`}><Mail size={16}/><span><small>邮箱</small>{selected.email}</span></a>
              <a href={selected.phone ? `tel:${selected.phone}` : undefined}><Phone size={16}/><span><small>电话 / WhatsApp</small>{selected.phone || "未填写"}</span></a>
              <div><Building2 size={16}/><span><small>公司 / 国家</small>{selected.companyName} · {selected.country}</span></div>
              <div><UserRound size={16}/><span><small>来源 / 提交时间</small>{selected.source} · {formatDate(selected.createdAt)}</span></div>
            </div><div className="crm-requirement"><strong>客户需求</strong><p>{selected.message}</p></div>
            {(selected.attachments || []).length > 0 && <div className="crm-attachments"><strong>客户附件</strong>{selected.attachments!.map((file) => <a href={`/api/admin/inquiries/attachments/${file.id}`} key={file.id}><Download size={13}/>{file.fileName}<small>{Math.ceil(file.size / 1024)} KB</small></a>)}</div>}
            </section>

            <section className="crm-card"><h3><MessageSquarePlus size={16}/>新增跟进记录</h3><div className="crm-followup-form">
              <label>跟进方式<select value={noteType} onChange={(event) => setNoteType(event.target.value)}>{Object.entries(activityLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label>跟进后阶段<select value={statusAfter} onChange={(event) => setStatusAfter(event.target.value)}>{statuses.map((value) => <option value={value} key={value}>{statusLabels[value]}</option>)}</select></label>
              <label>联系时间<input type="datetime-local" value={contactedAt} onChange={(event) => setContactedAt(event.target.value)}/></label>
              <label>下次跟进<input type="datetime-local" value={nextActionAt} onChange={(event) => setNextActionAt(event.target.value)}/></label>
              <label className="crm-span-2">本次沟通内容<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：客户确认需要 5,000 件，要求提供 CE/FCC 认证与定制包装报价。"/></label>
              <label className="crm-span-2">结果 / 下一步<input value={result} onChange={(event) => setResult(event.target.value)} placeholder="例如：已发送目录，周五前提供正式报价"/></label>
              <button className="btn btn-primary crm-span-2" type="button" disabled={busy} onClick={addFollowUp}>{busy ? "正在保存…" : "保存跟进并更新阶段"}</button>
            </div></section>

            <section className="crm-card"><h3>完整跟进时间线</h3><div className="crm-timeline">{timeline.length ? timeline.map((event) => event.kind === "note" ? <article key={`n-${event.item.id}`}>
              <i className="timeline-dot note"/><div><header><strong>{activityLabels[event.item.type] || event.item.type}</strong><span>{event.item.user?.name || "管理员"} · {formatDate(event.item.createdAt)}</span></header><p>{event.item.content}</p>{event.item.result && <small>结果：{event.item.result}</small>}<footer><span>阶段：{statusLabels[event.item.statusAfter || ""] || event.item.statusAfter}</span>{event.item.nextActionAt && <span>下次跟进：{formatDate(event.item.nextActionAt)}</span>}</footer></div>
            </article> : <article key={`a-${event.item.id}`}>
              <i className="timeline-dot handoff"/><div><header><strong>负责人交接</strong><span>{event.item.assignedBy?.name || "管理员"} · {formatDate(event.item.createdAt)}</span></header><p>{event.item.fromAssignee?.name || "未分配"} <ArrowRightLeft size={13}/> {event.item.toAssignee?.name || "取消分配"}</p>{event.item.reason && <small>原因：{event.item.reason}</small>}</div>
            </article>) : <div className="crm-empty">尚无跟进或交接记录</div>}</div></section>
          </div>

          <aside className="crm-side-column">
            <section className="crm-card crm-owner-card"><h3>负责人分配 / 交接</h3><div className="crm-current-owner"><span className="admin-avatar">{selected.assignedTo?.name?.slice(0, 1) || "?"}</span><div><small>当前负责人</small><strong>{selected.assignedTo?.name || "尚未分配"}</strong><span>{selected.assignedTo?.email || "请立即分配销售人员"}</span></div></div>
              <label>交接给谁<select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">取消分配</option>{admins.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
              <label>交接原因<textarea value={handoffReason} onChange={(event) => setHandoffReason(event.target.value)} placeholder="记录客户背景、当前进度和接手注意事项"/></label>
              <button className="btn btn-primary" type="button" disabled={busy || assignee === (selected.assignedToId || "")} onClick={handoff}><ArrowRightLeft size={14}/>{selected.assignedToId ? "确认交接" : "确认分配"}</button>
            </section>
            <section className="crm-card"><h3>销售阶段</h3><select value={selected.status} onChange={(event) => updatePipeline("status", event.target.value)} disabled={busy}>{statuses.map((value) => <option value={value} key={value}>{statusLabels[value]}</option>)}</select><h3 className="mt-4">优先级</h3><select value={selected.priority} onChange={(event) => updatePipeline("priority", event.target.value)} disabled={busy}>{Object.entries(priorityLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></section>
            <section className="crm-card crm-date-card"><h3>关键时间</h3><p><span>最后联系</span><strong>{formatDate(selected.lastContactAt)}</strong></p><p><span>下次跟进</span><strong>{formatDate(selected.nextFollowUpAt)}</strong></p><p><span>提交时间</span><strong>{formatDate(selected.createdAt)}</strong></p></section>
          </aside>
        </div>
      </div>
    </section></div>}
  </>;
}
