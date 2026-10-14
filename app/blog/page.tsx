import Link from "next/link";
import { NewsCover } from "@/components/public/NewsCover";
import type { Metadata } from "next";
import { ArrowRight, Clock3, Search } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { blogCategorySlugs, blogWhereFilter, isBlogCategorySlug, readingMinutes } from "@/lib/blog";
import { getLocale, translateEntities } from "@/lib/i18n";
import { getSeoMetadata } from "@/lib/seo";
import { absoluteUrl, formatDate } from "@/lib/utils";
import { JsonLd } from "@/components/public/JsonLd";
import "@/components/public/blog.css";

type Query = { category?: string | string[]; q?: string | string[]; page?: string | string[] };
const pageSize = 9;
function normalizedQuery(params: Query) {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || "" : value || "";
  const pageNumber = Number(first(params.page) || 1);
  return { category: first(params.category), q: first(params.q).trim().slice(0, 120), page: Number.isInteger(pageNumber) && pageNumber > 0 ? Math.min(pageNumber, 10000) : 1 };
}
function listingUrl(category: string, q: string, page = 1) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  return `/blog${params.size ? `?${params}` : ""}`;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Query> }): Promise<Metadata> {
  const { category, q, page } = normalizedQuery(await searchParams);
  const base = await getSeoMetadata("/blog", {
    title: "Power Bank & Wireless Charging Sourcing Blog | Shanze",
    description: "Practical B2B guides for sourcing power banks and wireless chargers. Explore OEM project planning, supplier evaluation and custom power bank RFQ checklists.",
  });
  if (category || q) return { ...base, alternates: { canonical: absoluteUrl("/blog") }, robots: { index: false, follow: true } };
  if (page > 1) return { ...base, title: { absolute: `Charging Product Sourcing Blog — Page ${page} | Shanze` }, alternates: { canonical: absoluteUrl(listingUrl("", "", page)) } };
  return base;
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<Query> }) {
  const { category, q, page } = normalizedQuery(await searchParams);
  if (category && !isBlogCategorySlug(category)) notFound();
  const locale = await getLocale();
  const zh = locale === "zh";
  const where = { ...blogWhereFilter, ...(category ? { category: { slug: category } } : {}), ...(q ? { OR: [{ title: { contains: q } }, { excerpt: { contains: q } }, { content: { contains: q } }] } : {}) };
  const [categories, rawPosts, total] = await Promise.all([
    db.newsCategory.findMany({ where: { slug: { in: [...blogCategorySlugs] } }, orderBy: { sortOrder: "asc" } }),
    db.news.findMany({ where, include: { category: true }, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    db.news.count({ where }),
  ]);
  if (page > 1 && (page - 1) * pageSize >= total) notFound();
  const [posts, localizedCategories] = await Promise.all([
    translateEntities("News", rawPosts, ["title", "excerpt", "content"], locale),
    translateEntities("NewsCategory", categories, ["name"], locale),
  ]);
  const categoryNames = Object.fromEntries(localizedCategories.map((item) => [item.id, item.name]));
  const totalPages = Math.ceil(total / pageSize);
  return <>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "Shanze B2B Charging Product Sourcing Blog", description: "Power bank, magnetic charging and OEM sourcing guides for B2B buyers.", url: absoluteUrl("/blog"), mainEntity: { "@type": "ItemList", itemListElement: rawPosts.filter((post) => !post.noIndex).map((post, index) => ({ "@type": "ListItem", position: (page - 1) * pageSize + index + 1, name: post.title, url: absoluteUrl(`/blog/${post.slug}`) })) } }} />
    <section className="blog-hero"><div className="container-site">
      <nav className="blog-breadcrumb" aria-label={zh ? "面包屑导航" : "Breadcrumb"}><Link href="/">{zh ? "首页" : "Home"}</Link><span>/</span><span>{zh ? "行业博客" : "Industry Blog"}</span></nav>
      <div className="eyebrow">{zh ? "面向海外 B2B 采购" : "B2B BUYER RESOURCES"}</div>
      <h1>{zh ? "充电产品采购与 OEM 指南" : "Power Bank & Wireless Charging Sourcing Guides"}</h1>
      <p>{zh ? "从供应商评估到产品需求和 OEM 项目规划，为品牌、分销商与采购团队提供实用参考。" : "Practical guidance for brands, distributors and sourcing teams: compare suppliers, define product requirements and plan an OEM charging product project."}</p>
      <div className="blog-hero-links"><Link href="/power-bank-manufacturer">{zh ? "充电宝制造" : "Power Bank Manufacturing"}<ArrowRight size={16} /></Link><Link href="/wireless-charger-manufacturer">{zh ? "无线充电器制造" : "Wireless Charger Manufacturing"}<ArrowRight size={16} /></Link></div>
    </div></section>
    <section className="section blog-listing"><div className="container-site">
      <div className="blog-filters">
        <nav className="blog-category-tabs" aria-label={zh ? "博客分类" : "Blog categories"}><Link href={listingUrl("", q)} className={!category ? "active" : ""}>{zh ? "全部指南" : "All Guides"}</Link>{localizedCategories.map((item) => <Link key={item.id} href={listingUrl(item.slug, q)} className={item.slug === category ? "active" : ""}>{item.name}</Link>)}</nav>
        <form className="blog-search" action="/blog"><label className="sr-only" htmlFor="blog-search">{zh ? "搜索博客" : "Search blog"}</label><input id="blog-search" name="q" type="search" defaultValue={q} placeholder={zh ? "搜索指南…" : "Search guides…"} maxLength={120} />{category && <input type="hidden" name="category" value={category} />}<button type="submit" aria-label={zh ? "搜索" : "Search"}><Search size={18} /></button></form>
      </div>
      {posts.length ? <div className="blog-card-grid">{posts.map((post) => <article className="blog-card" key={post.id}>
        {post.coverImage && <Link href={`/blog/${post.slug}`} tabIndex={-1} aria-hidden="true"><NewsCover src={post.coverImage} alt={post.title} /></Link>}
        <div className="blog-card-content"><span className="blog-tag">{categoryNames[post.categoryId] || post.category.name}</span><h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2><p>{post.excerpt}</p><div className="blog-card-meta"><time dateTime={post.publishedAt?.toISOString() || post.createdAt.toISOString()}>{formatDate(post.publishedAt || post.createdAt, locale)}</time><span><Clock3 size={14} />{readingMinutes(post.content)} {zh ? "分钟" : "min read"}</span></div><Link className="text-link" href={`/blog/${post.slug}`}>{zh ? "阅读指南" : "Read guide"}<ArrowRight size={16} /></Link></div>
      </article>)}</div> : <div className="blog-empty"><h2>{zh ? "暂未找到相关文章" : "No matching guides"}</h2><p>{zh ? "尝试其他搜索词，或浏览所有行业指南。" : "Try a different search or browse all sourcing guides."}</p><Link className="text-link" href="/blog">{zh ? "浏览全部指南" : "View all guides"}</Link></div>}
      {totalPages > 1 && <nav className="blog-pagination" aria-label={zh ? "博客分页" : "Blog pagination"}>{page > 1 && <Link href={listingUrl(category, q, page - 1)} rel="prev">← {zh ? "上一页" : "Previous"}</Link>}<span>{zh ? `第 ${page} / ${totalPages} 页` : `Page ${page} of ${totalPages}`}</span>{page < totalPages && <Link href={listingUrl(category, q, page + 1)} rel="next">{zh ? "下一页" : "Next"} →</Link>}</nav>}
      <div className="blog-project-cta"><div><h2>{zh ? "准备开始您的 OEM 项目？" : "Planning a charging product project?"}</h2><p>{zh ? "将目标市场、产品需求和包装计划发送给我们，讨论适合您项目的方案。" : "Share your target market, product requirements and packaging plans with our team."}</p></div><Link className="btn btn-primary" href="/contact#quote">{zh ? "提交项目需求" : "Discuss Your Project"}<ArrowRight size={17} /></Link></div>
    </div></section>
  </>;
}
