export async function getFreshCsrfToken() {
  const response = await fetch(`/api/csrf?t=${Date.now()}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.token) {
    throw new Error(data.error || "无法获取安全令牌，请刷新页面后重试");
  }
  return String(data.token);
}
