"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, LockKeyhole, RefreshCw, UserRound } from "lucide-react";

type LoginChallenge = {
  code: string;
  loginToken: string;
};

// React development mode intentionally mounts effects twice. Reusing the same
// in-flight request keeps the visible code, signed token and HttpOnly cookie in
// one challenge instead of letting two captcha requests overwrite each other.
let activeChallengeRequest: Promise<LoginChallenge> | null = null;

function requestLoginChallenge(force = false) {
  if (force || !activeChallengeRequest) {
    activeChallengeRequest = fetch(`/api/auth/captcha?t=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.code || !data.loginToken) {
          throw new Error("验证码生成失败");
        }
        return {
          code: String(data.code),
          loginToken: String(data.loginToken),
        };
      })
      .catch((error) => {
        activeChallengeRequest = null;
        throw error;
      });
  }
  return activeChallengeRequest;
}

export function LoginForm() {
  const [captcha, setCaptcha] = useState("");
  const [loginToken, setLoginToken] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshCaptcha(force = false) {
    const challenge = await requestLoginChallenge(force);
    setCaptcha(challenge.code);
    setLoginToken(challenge.loginToken);
    setCaptchaInput("");
  }

  useEffect(() => {
    refreshCaptcha().catch(
      () => setError("无法初始化登录安全信息，请刷新页面"),
    );
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-login-token": loginToken,
        },
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password"),
          captcha: formData.get("captcha"),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        try {
          sessionStorage.setItem("enercore_login_welcome", JSON.stringify({ name: String(data.userName || formData.get("username") || "管理员"), at: Date.now() }));
        } catch {
          // 登录仍可继续，提示信息不是认证所必需。
        }
        location.href = "/admin";
        return;
      }
      setError(data.error || "登录失败");
      await refreshCaptcha(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="login-card">
      <div className="mb-8">
        <div className="eyebrow">Secure Administration</div>
        <h1>登录 ENERCORE CMS</h1>
        <p className="muted">使用管理员用户名、密码和验证码登录。</p>
      </div>
      {error && <div className="form-status error mb-4">{error}</div>}
      <div className="field mb-4">
        <label htmlFor="username">管理员用户名</label>
        <div className="relative">
          <UserRound size={16} className="absolute left-3 top-3.5 text-slate-400" />
          <input className="!pl-10" id="username" name="username" required autoComplete="username" placeholder="请输入管理员用户名" />
        </div>
      </div>
      <div className="field mb-4">
        <label htmlFor="password">密码</label>
        <div className="relative">
          <LockKeyhole size={16} className="absolute left-3 top-3.5 text-slate-400" />
          <input className="!pl-10" id="password" name="password" type="password" required autoComplete="current-password" minLength={8} />
        </div>
      </div>
      <div className="field mb-6">
        <label htmlFor="captcha">数字验证码</label>
        <div className="login-captcha-row">
          <div className="relative flex-1">
            <KeyRound size={16} className="absolute left-3 top-3.5 text-slate-400" />
            <input
              className="!pl-10"
              id="captcha"
              name="captcha"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              required
              placeholder="输入右侧数字"
              value={captchaInput}
              onChange={(event) => setCaptchaInput(event.target.value.replace(/\D/g, "").slice(0, 4))}
              autoComplete="off"
            />
          </div>
          <span className="login-captcha-code" aria-label="系统生成的验证码">{captcha || "----"}</span>
          <button type="button" className="icon-btn" onClick={() => refreshCaptcha(true).catch(() => setError("验证码刷新失败"))} aria-label="刷新验证码">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>
      <button className="btn btn-primary w-full" disabled={busy || !loginToken || !captcha || captchaInput.length !== 4}>
        {busy ? "正在验证..." : "安全登录"}
      </button>
      <p className="mt-5 text-center text-xs text-slate-500">连续 5 次失败将锁定账号 15 分钟</p>
    </form>
  );
}
