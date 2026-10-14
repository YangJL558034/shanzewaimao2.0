import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { getLocale, translateEntity } from "@/lib/i18n";
import { JsonLd } from "@/components/public/JsonLd";
import { absoluteUrl } from "@/lib/utils";
import { safeCanonicalUrl } from "@/lib/seo";
import { isBlogCategorySlug, parseBlogContent } from "@/lib/blog";
import { BlogContent } from "@/components/public/BlogContent";
import { NewsCover, newsCoverSource } from "@/components/public/NewsCover";
import { resolveSeoImage } from "@/lib/image-seo-data";
import "@/components/public/blog.css";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await db.news.findUnique({ where: { slug }, include: { category: true } });
  if (!post || post.status !== "PUBLISHED") return { title: { absolute: "Article Not Found | Shanze" }, robots: { index: false, follow: false } };
  if (isBlogCategorySlug(post.category.slug)) permanentRedirect(`/blog/${post.slug}`);
  const title = post.seoTitle || `${post.title} | Shanze News`;
  const description = post.metaDescription || post.excerpt.slice(0, 160);
  const canonical = safeCanonicalUrl(`/news/${post.slug}`, post.canonical);
  const image = newsCoverSource(post.ogImage) || newsCoverSource(post.coverImage);
  const images = image ? [absoluteUrl(await resolveSeoImage(image))] : [];
  return { title: { absolute: title }, description, alternates: { canonical }, robots: { index: !post.noIndex, follow: true }, openGraph: { type: "article", title: post.ogTitle || title, description: post.ogDescription || description, url: canonical, publishedTime: (post.publishedAt || post.createdAt).toISOString(), modifiedTime: post.updatedAt.toISOString(), images }, twitter: { card: images.length ? "summary_large_image" : "summary", title: post.ogTitle || title, description: post.ogDescription || description, images } };
}

export default async function NewsDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rawPost = await db.news.findFirst({ where: { slug, status: "PUBLISHED" }, include: { category: true } });
  if (!rawPost) notFound();
  if (isBlogCategorySlug(rawPost.category.slug)) permanentRedirect(`/blog/${rawPost.slug}`);
  const locale = await getLocale();
  const zh = locale === "zh";
  const [post, category] = await Promise.all([translateEntity("News", rawPost, ["title", "excerpt", "content"], locale), translateEntity("NewsCategory", rawPost.category, ["name"], locale)]);
  const canonical = safeCanonicalUrl(`/news/${post.slug}`, post.canonical);
  const coverSource = newsCoverSource(post.coverImage);
  const cover = coverSource ? await resolveSeoImage(coverSource) : "";
  return <article className="section">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "Article", headline: post.title, description: post.excerpt, ...(cover ? { image: [absoluteUrl(cover)] } : {}), datePublished: (post.publishedAt || post.createdAt).toISOString(), dateModified: post.updatedAt.toISOString(), author: { "@type": "Organization", name: post.author || "Shanze Editorial" }, publisher: { "@id": `${absoluteUrl("/")}#organization` }, mainEntityOfPage: canonical, inLanguage: zh ? "zh-CN" : "en" }} />
    <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: zh ? "首页" : "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: zh ? "新闻" : "News", item: absoluteUrl("/news") }, { "@type": "ListItem", position: 3, name: post.title, item: canonical }] }} />
    <div className="container-site max-w-4xl"><nav className="blog-breadcrumb" aria-label="Breadcrumb"><Link href="/">{zh ? "首页" : "Home"}</Link><span>/</span><Link href="/news">{zh ? "新闻" : "News"}</Link><span>/</span><span>{category.name}</span></nav><div className="eyebrow">{category.name} · {formatDate(post.publishedAt || post.createdAt, locale)}</div><h1 className="text-3xl md:text-5xl font-bold leading-tight mt-4">{post.title}</h1><p className="hero-subtitle">{post.excerpt}</p><NewsCover src={cover} alt={post.title} priority className="news-article-cover" /><BlogContent blocks={parseBlogContent(post.content)} /><div className="mt-10 flex flex-wrap gap-4"><Link className="text-link" href="/power-bank-manufacturer">{zh ? "充电宝制造" : "Power Bank Manufacturing"} →</Link><Link className="text-link" href="/blog">{zh ? "采购指南" : "Sourcing Guides"} →</Link><Link className="text-link" href="/contact#quote">{zh ? "提交询盘" : "Send RFQ"} →</Link></div></div>
  </article>;
}
