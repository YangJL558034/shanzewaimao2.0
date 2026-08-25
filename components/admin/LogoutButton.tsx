"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { getFreshCsrfToken } from "@/lib/csrf-client";

export function LogoutButton() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function logout() {
    if (state === "loading") return;
    setState("loading");
    try {
      const token = await getFreshCsrfToken().catch(() => "");
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: token ? { "x-csrf-token": token } : undefined,
      });
      if (!response.ok) throw new Error("logout failed");
      sessionStorage.removeItem("enercore_login_welcome");
      location.replace("/admin/login?loggedOut=1");
    } catch {
      setState("error");
    }
  }

  return (
    <span className="admin-logout-wrap">
      <button
        type="button"
        className="admin-top-tool admin-logout-button"
        onClick={logout}
        disabled={state === "loading"}
        title="退出登录"
        aria-label="退出登录"
      >
        <LogOut size={15} />
        <span>{state === "loading" ? "退出中…" : "退出"}</span>
      </button>
      {state === "error" && <small role="alert">退出失败，请重试</small>}
    </span>
  );
}
