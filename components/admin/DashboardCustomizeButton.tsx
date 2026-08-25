"use client";

import { useState } from "react";
import { RotateCcw, Settings, X } from "lucide-react";
import { dashboardDefaults, type DashboardPreferences } from "@/lib/dashboard";
import { getFreshCsrfToken } from "@/lib/csrf-client";

const groups = [
  { key: "stats", title: "统计卡片", items: [["products", "产品总数"], ["news", "新闻总数"], ["inquiries", "询盘总数"], ["pending", "待跟进"], ["visits", "今日访问量"], ["subscribers", "有效订阅"], ["admins", "管理员"], ["media", "文件数量"]] },
  { key: "quick", title: "快捷操作", items: [["products", "产品管理"], ["news", "新闻管理"], ["inquiries", "询盘管理"], ["media", "媒体中心"], ["seo", "SEO 设置"], ["security", "管理员"]] },
  { key: "panels", title: "控制台模块", items: [["traffic", "网站访问统计"], ["subscriptions", "订阅增长统计"], ["trend", "询盘趋势"], ["sources", "询盘来源"], ["recent", "最新询盘"], ["quick", "快捷操作区"], ["system", "系统状态"], ["audit", "操作日志"]] },
] as const;

type DashboardGroup = "stats" | "quick" | "panels";

export function DashboardCustomizeButton({ initial }: { initial: DashboardPreferences }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<DashboardPreferences>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function toggle(group: DashboardGroup, item: string) {
    setValue((current) => ({
      ...current,
      version: 2,
      [group]: current[group].includes(item)
        ? current[group].filter((entry) => entry !== item)
        : [...current[group], item],
    }));
  }

  async function save() {
    setBusy(true); setError("");
    try {
      const csrf = await getFreshCsrfToken();
      const response = await fetch("/api/admin/dashboard", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(value),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
      setBusy(false);
    }
  }

  return <>
    <button className="btn btn-outline btn-sm" onClick={() => setOpen(true)}><Settings size={14}/>自定义</button>
    {open && <div className="modal-backdrop"><div className="admin-modal dashboard-custom-modal">
      <div className="modal-head"><h2>自定义控制台</h2><button className="icon-btn" onClick={() => setOpen(false)} aria-label="关闭"><X size={16}/></button></div>
      <div className="modal-body">
        <p className="muted mb-4 text-xs">选择控制台需要显示的统计、快捷入口和信息模块。配置会按当前管理员保存到 SQLite。</p>
        {error && <div className="form-status error mb-3">{error}</div>}
        <div className="dashboard-custom-groups">{groups.map((group) => (
          <section key={group.key}><h3>{group.title}</h3><div className="dashboard-custom-options">{group.items.map(([key, label]) => (
            <label key={key}><input type="checkbox" checked={value[group.key].includes(key)} onChange={() => toggle(group.key, key)}/><span>{label}</span></label>
          ))}</div></section>
        ))}</div>
      </div>
      <div className="modal-foot"><button className="btn btn-outline btn-sm" onClick={() => setValue(dashboardDefaults)}><RotateCcw size={13}/>恢复默认</button><button className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>取消</button><button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>{busy ? "正在保存…" : "保存并刷新"}</button></div>
    </div></div>}
  </>;
}
