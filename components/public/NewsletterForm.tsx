"use client";

import { FormEvent, useRef, useState } from "react";
import { Check, RefreshCw, ShieldCheck, X } from "lucide-react";

type Challenge = {
  challengeToken: string;
  target: number;
  expiresAt: number;
};

export function NewsletterForm({ locale, compact = false }: { locale: string; compact?: boolean }) {
  const zh = locale === "zh";
  const formRef = useRef<HTMLFormElement>(null);
  const completionStarted = useRef(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [position, setPosition] = useState(0);
  const [verified, setVerified] = useState(false);
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [challengeError, setChallengeError] = useState("");

  async function refreshChallenge() {
    setChallengeBusy(true);
    setChallengeError("");
    setChallenge(null);
    setVerified(false);
    setPosition(0);
    completionStarted.current = false;
    try {
      const response = await fetch(`/api/newsletter/challenge?t=${Date.now()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Verification unavailable");
      setChallenge(result);
    } catch {
      setChallengeError(zh ? "验证加载失败，请点击刷新后重试。" : "Verification failed to load. Please refresh and try again.");
    } finally {
      setChallengeBusy(false);
    }
  }

  function requestVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const email = String(new FormData(event.currentTarget).get("email") || "").trim();
    setPendingEmail(email);
    setStatus(null);
    setShowVerification(true);
    void refreshChallenge();
  }

  async function completeSubscription(activeChallenge: Challenge, slidePosition: number) {
    setBusy(true);
    try {
      const data = new FormData(formRef.current || undefined);
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: pendingEmail,
          locale: zh ? "zh" : "en",
          challengeToken: activeChallenge.challengeToken,
          slidePosition,
          website: String(data.get("website") || ""),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || (zh ? "订阅失败，请稍后重试。" : "Subscription failed. Please try again."));
      setStatus({ type: "success", message: result.message || (zh ? "订阅成功！新闻和新品发布后会发送到您的邮箱。" : "Subscribed! News and product updates will be sent to your inbox.") });
      formRef.current?.reset();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : (zh ? "订阅失败，请稍后重试。" : "Subscription failed. Please try again.") });
    } finally {
      setBusy(false);
      setShowVerification(false);
      setChallenge(null);
      setPendingEmail("");
      setPosition(0);
      setVerified(false);
      completionStarted.current = false;
    }
  }

  function moveSlider(value: number) {
    if (!challenge || verified || completionStarted.current) return;
    setPosition(value);
    if (Math.abs(value - challenge.target) <= 3) {
      completionStarted.current = true;
      setPosition(challenge.target);
      setVerified(true);
      window.setTimeout(() => void completeSubscription(challenge, challenge.target), 320);
    }
  }

  function closeVerification() {
    if (busy) return;
    setShowVerification(false);
    setChallenge(null);
    setPosition(0);
    setVerified(false);
    setChallengeError("");
    completionStarted.current = false;
  }

  return <div className={`newsletter-form-wrap ${compact ? "is-compact" : ""}`}>
    <form ref={formRef} className={`newsletter-secure-form ${compact ? "is-compact" : ""}`} onSubmit={requestVerification}>
      <label className="newsletter-honeypot" aria-hidden="true">
        Website<input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <div className={compact ? "newsletter" : "newsletter-fields"}>
        <input className={compact ? undefined : "rounded border p-2"} type="email" name="email" placeholder={zh ? "您的邮箱地址" : "Your email address"} aria-label={zh ? "订阅邮箱" : "Subscription email"} required disabled={busy || showVerification} />
        <button className={compact ? undefined : "btn btn-primary btn-sm"} disabled={busy || showVerification} aria-label={zh ? "提交订阅" : "Subscribe"}>{busy ? (zh ? "…" : "…") : compact ? "→" : (zh ? "订阅" : "Subscribe")}</button>
      </div>
    </form>
    {status && <p className={`newsletter-feedback ${status.type}`} role="status" aria-live="polite">{status.message}</p>}

    {showVerification && <div className="newsletter-verification-popover">
      <section className="newsletter-verification-dialog" role="dialog" aria-modal="false" aria-labelledby="newsletter-verification-title">
        <header>
          <span className="newsletter-verification-icon"><ShieldCheck size={20} /></span>
          <div>
            <strong id="newsletter-verification-title">{zh ? "完成安全验证" : "Security verification"}</strong>
            <small>{zh ? "滑动验证后即可完成订阅" : "Complete the slider to subscribe"}</small>
          </div>
          <button type="button" className="newsletter-verification-close" onClick={closeVerification} disabled={busy} aria-label={zh ? "关闭验证" : "Close verification"}><X size={17} /></button>
        </header>
        <p className="newsletter-verification-email">{pendingEmail}</p>
        <div className={`slide-verification ${verified ? "is-verified" : ""} ${challengeBusy ? "is-loading" : ""}`}>
          <div className="slide-verification-track" aria-hidden="true">
            <span className="slide-verification-progress" style={{ width: `${position}%` }} />
            {challenge && <span className="slide-verification-target" style={{ left: `${challenge.target}%` }} />}
            <span className="slide-verification-label">
              {verified
                ? <><Check size={15} />{zh ? "验证通过，正在订阅…" : "Verified. Subscribing…"}</>
                : challengeBusy
                  ? (zh ? "正在生成安全验证…" : "Preparing secure verification…")
                  : (zh ? "向右滑动到蓝色目标位置" : "Slide right to the blue target")}
            </span>
          </div>
          <input
            className="slide-verification-input"
            type="range"
            min="0"
            max="100"
            step="1"
            value={position}
            disabled={!challenge || challengeBusy || verified || busy}
            aria-label={zh ? "订阅滑动验证" : "Subscription slider verification"}
            aria-valuetext={verified ? (zh ? "验证通过" : "Verified") : `${position}%`}
            onChange={(event) => moveSlider(Number(event.target.value))}
          />
          <button className="slide-verification-refresh" type="button" onClick={() => void refreshChallenge()} disabled={challengeBusy || busy} aria-label={zh ? "刷新滑动验证" : "Refresh slider verification"}>
            <RefreshCw size={15} />
          </button>
        </div>
        {challengeError && <p className="newsletter-verification-error" role="alert">{challengeError}</p>}
        <small className="newsletter-verification-note">{zh ? "验证 5 分钟内有效且只能使用一次" : "Verification expires in 5 minutes and can only be used once"}</small>
      </section>
    </div>}
  </div>;
}
