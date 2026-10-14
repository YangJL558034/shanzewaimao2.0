"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, ExternalLink, Globe, BarChart3 } from "lucide-react";
import { getFreshCsrfToken } from "@/lib/csrf-client";

export function SeoIntegrationSettings({ canWrite }: { canWrite: boolean }) {
  const [data, setData] = useState({ ga4Id: "", searchConsoleToken: "" });
  const [origin, setOrigin] = useState("https://shanzesz.com");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [stats, setStats] = useState({ products: 0, posts: 0, noIndexRoutes: [] as string[] });
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  useEffect(() => {
    fetch("/api/admin/seo-tools", { credentials: "same-origin" }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "配置加载失败");
      setData(payload.data); setOrigin(payload.origin); setStats(payload.stats); setAnalyticsEnabled(payload.analyticsEnabled); setLoaded(true);
    }).catch((error) => setNotice(error.message || "配置加载失败"));
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const token = await getFreshCsrfToken();
      const response = await fetch("/api/admin/seo-tools", { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json", "x-csrf-token": token }, body: JSON.stringify(data) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "保存失败");
      setNotice("Google 接入配置已保存。请到 Google 平台验证所有权 / 检查实时数据；保存不代表已验证或已被收录。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "保存失败"); } finally { setBusy(false); }
  }
  return <div className="grid gap-5">
    <section className="admin-panel p-5">
      <div className="admin-panel-head -m-5 mb-5"><div><h2>Google 接入</h2><p>正式网址、所有权验证和海外自然搜索统计。</p></div><Globe size={22} /></div>
      <p className="mb-5 rounded-lg bg-slate-50 p-3 text-sm">正式域名：<strong>{origin}</strong> · English 为默认抓取语言；保留现有语言切换。{!analyticsEnabled && <span className="block mt-1 muted">当前为开发环境，GA4 不发送统计，避免测试流量污染正式数据。</span>}</p>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
        <label className="field"><span>GA4 衡量 ID</span><input value={data.ga4Id} placeholder="G-XXXXXXXXXX" disabled={!canWrite} onChange={(event) => setData({ ...data, ga4Id: event.target.value.trim().toUpperCase() })} /><small className="muted">Google Analytics → 管理 → 数据流 → 网站 → 衡量 ID。</small></label>
        <label className="field"><span>Search Console HTML 验证 token</span><input value={data.searchConsoleToken} placeholder="google-site-verification 的 content 值" disabled={!canWrite} onChange={(event) => setData({ ...data, searchConsoleToken: event.target.value.trim() })} /><small className="muted">用于 URL 前缀资源验证；完整“域名资源”仍需在 DNS 添加 Google TXT 记录。</small></label>
        {notice && <p className="form-status md:col-span-2" role="status">{notice}</p>}
        <div className="md:col-span-2"><button className="btn btn-primary" disabled={!loaded || busy || !canWrite}>{busy ? "保存中…" : "保存 Google 配置"}</button></div>
      </form>
    </section>
    <section className="admin-panel p-5">
      <div className="flex items-center gap-2 mb-4"><CheckCircle2 size={20} className="text-emerald-600" /><h2>抓取与索引</h2></div>
      <p className="muted text-sm mb-4">当前 {stats.products} 个可索引产品、{stats.posts} 篇可索引文章。草稿和 noindex 内容不会进入 XML Sitemap；分类与搜索结果不作为独立 SEO 页面。</p>
      <div className="flex flex-wrap gap-4 text-sm"><a className="text-link" href={`${origin}/sitemap.xml`} target="_blank" rel="noreferrer">XML Sitemap <ExternalLink size={13} /></a><a className="text-link" href={`${origin}/robots.txt`} target="_blank" rel="noreferrer">Robots.txt <ExternalLink size={13} /></a><Link className="text-link" href="/admin/seo">页面 SEO 编辑 →</Link><Link className="text-link" href="/admin/news">博客 / 新闻内容 →</Link></div>
      {stats.noIndexRoutes.length > 0 && <p className="mt-4 text-sm">已禁止索引的页面：{stats.noIndexRoutes.join("、")}</p>}
    </section>
    <section className="admin-panel p-5">
      <div className="flex items-center gap-2 mb-4"><BarChart3 size={20} /><h2>上线后检查</h2></div>
      <ol className="list-decimal ml-5 space-y-2 text-sm text-slate-600">
        <li>在 Search Console 添加 <strong>{origin}/</strong> URL 前缀资源，完成 HTML 验证，提交 <strong>{origin}/sitemap.xml</strong>。域名资源请使用 DNS 验证。</li>
        <li>关闭 GA4 数据流中的“增强型衡量”（包括历史变更、表单、站内搜索、外链等自动采集）。本站使用手动 SPA page_view 和受控询盘事件，避免重复计数或上传客户资料。不要在 Google 平台另行开启用户提供的数据收集。</li>
        <li>只有同意统计 Cookie 且未开启 Do Not Track 的访客加载 GA4。本站仅发送页面地址（无 query/hash）、询盘成功、聊天与渠道点击事件，不发送客户联系方式和消息正文。</li>
        <li>在 GA4 将 <strong>generate_lead</strong> 设为关键事件，按自然搜索来源、落地页和询盘转化观察效果。外部渠道点击不是已收到询盘。</li>
        <li>在 Search Console 查看索引、点击、展示和查询词，持续发布真实案例与技术内容；代码接入不等于排名或收录保证。</li>
      </ol>
      <div className="flex gap-5 mt-5"><a className="text-link" href="https://search.google.com/search-console" target="_blank" rel="noreferrer">Search Console →</a><a className="text-link" href="https://analytics.google.com/" target="_blank" rel="noreferrer">Google Analytics →</a></div>
    </section>
  </div>;
}
