"use client";

import Link from "next/link";
import { Bell, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cmsSections } from "@/lib/cms";

export function AdminTopbarTools() {
  const [query, setQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const results = useMemo(
    () =>
      query.trim()
        ? cmsSections
            .filter((section) =>
              `${section.label} ${section.description}`
                .toLowerCase()
                .includes(query.trim().toLowerCase()),
            )
            .slice(0, 7)
        : [],
    [query],
  );
  return (
    <div className="admin-topbar-tools">
      <div className="admin-command-search">
        <Search size={14} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索功能、内容、帮助…"
          aria-label="搜索后台功能"
        />
        <kbd>⌘K</kbd>
        {results.length > 0 && (
          <div className="admin-command-results">
            {results.map((section) => (
              <Link
                key={section.key}
                href={`/admin/${section.key}`}
                onClick={() => setQuery("")}
              >
                <strong>{section.label}</strong>
                <span>{section.description}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        className="admin-top-tool"
        onClick={() => location.reload()}
        title="刷新当前后台数据"
      >
        <RefreshCw size={15} /> 刷新数据
      </button>
      <div className="admin-notifications">
        <button
          type="button"
          className="admin-top-tool icon-only"
          onClick={() => setNotificationsOpen((open) => !open)}
          aria-label="通知"
        >
          <Bell size={17} />
        </button>
        {notificationsOpen && (
          <div className="admin-notification-panel">
            <strong>工作提醒</strong>
            <Link href="/admin/inquiries">查看待跟进询盘</Link>
            <Link href="/admin/email-queue">检查邮件发送队列</Link>
            <Link href="/admin/backups">检查数据库备份</Link>
          </div>
        )}
      </div>
    </div>
  );
}
