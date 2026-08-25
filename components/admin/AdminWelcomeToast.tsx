"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";

const STORAGE_KEY = "enercore_login_welcome";

export function AdminWelcomeToast({ fallbackName }: { fallbackName: string }) {
  const [name, setName] = useState("");
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      sessionStorage.removeItem(STORAGE_KEY);
      const value = JSON.parse(raw) as { name?: string; at?: number };
      if (value.at && Date.now() - value.at > 60_000) return;
      setName(value.name?.trim() || fallbackName);
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [fallbackName]);

  useEffect(() => {
    if (!name) return;
    const timer = window.setTimeout(() => close(), 4200);
    return () => window.clearTimeout(timer);
  }, [name]);

  function close() {
    setClosing(true);
    window.setTimeout(() => setName(""), 220);
  }

  if (!name) return null;
  return <div className={`admin-welcome-toast${closing ? " is-closing" : ""}`} role="status" aria-live="polite">
    <span className="admin-welcome-toast-icon"><Check size={19} strokeWidth={3} /></span>
    <span><strong>欢迎回来，{name}</strong><small>登录成功，管理中心已准备就绪。</small></span>
    <button type="button" onClick={close} aria-label="关闭欢迎提示"><X size={16} /></button>
  </div>;
}
