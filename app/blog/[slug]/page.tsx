import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Clock3 } from "lucide-react";
import { db } from "@/lib/db";
import { blogWhereFilter, getPublishedBlogPost, parseBlogContent, readingMinutes } from "@/lib/blog";
import { getLocale, translateEntity, translateEntities } from "@/lib/i18n";
import { absoluteUrl, formatDate } from "@/lib/utils";
import { safeCanonicalUrl } from "@/lib/seo";
import { JsonLd } from "@/components/public/JsonLd";
import { BlogContent } from "@/components/public/BlogContent";
import { NewsCover, newsCoverSource } from "@/components/public/NewsCover";
import { resolveSeoImage } from "@/lib/image-seo-data";
import "@/components/public/blog.css";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  if (!post) return { title: { absolute: "Guide Not Found | Shanze" }, robots: { index: false, follow: false } };
  const title = post.seoTitle || `${post.title} | Shanze`;
  const description = post.metaDescription || post.excerpt.slice(0, 160);
  const canonical = safeCanonicalUrl(`/blog/${post.slug}`);
  const image = newsCoverSource(post.ogImage) || newsCoverSource(post.coverImage);
  const images = image ? [absoluteUrl(await resolveSeoImage(image))] : [];
  return {
    title: { absolute: title }, description, alternates: { canonical }, robots: { index: !post.noIndex, follow: true },
    openGraph: { type: "article", title: post.ogTitle || title, description: post.ogDescription || description, url: canonical, images, publishedTime: (post.publishedAt || post.createdAt).toISOString(), modifiedTime: post.updatedAt.toISOString(), authors: [post.author] },
    twitter: { card: images.length ? "summary_large_image" : "summary", title: post.ogTitle || title, description: post.ogDescription || description, images },
  };
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const raw = await getPublishedBlogPost(slug);
  if (!raw) notFound();
  const locale = await getLocale();
  const zh = locale === "zh";
  const [post, category, relatedRaw] = await Promise.all([
    translateEntity("News", raw, ["title", "excerpt", "content"], locale),
    translateEntity("NewsCategory", raw.category, ["name"], locale),
    db.news.findMany({ where: { ...blogWhereFilter, id: { not: raw.id } }, orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }], take: 12 }),
  ]);
  const related = await translateEntities("News", [...relatedRaw.filter((item) => item.categoryId === raw.categoryId), ...relatedRaw.filter((item) => item.categoryId !== raw.categoryId)].slice(0, 3), ["title", "excerpt"], locale);
  const blocks = parseBlogContent(post.content);
  const headings = blocks.filter((block) => block.type === "heading" && block.level === 2);
  const canonical = absoluteUrl(`/blog/${raw.slug}`);
  const date = post.publishedAt || post.createdAt;
  const coverSource = newsCoverSource(post.coverImage);
  const cover = coverSource ? await resolveSeoImage(coverSource) : "";
  const publisherLogo = absoluteUrl(await resolveSeoImage("/shanze-brand-icon.png"));
  return <>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description: post.excerpt, ...(cover ? { image: [absoluteUrl(cover)] } : {}), datePublished: date.toISOString(), dateModified: post.updatedAt.toISOString(), author: { "@type": "Organization", name: post.author || "Shanze Editorial", url: absoluteUrl("/about") }, publisher: { "@type": "Organization", name: "Shanze", url: absoluteUrl("/"), logo: { "@type": "ImageObject", url: publisherLogo } }, mainEntityOfPage: { "@type": "WebPage", "@id": canonical }, url: canonical, articleSection: category.name, inLanguage: zh ? "zh-CN" : "en" }} />
    <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: zh ? "首页" : "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: zh ? "行业博客" : "Industry Blog", item: absoluteUrl("/blog") }, { "@type": "ListItem", position: 3, name: post.title, item: canonical }] }} />
    <article>
      <header className="blog-hero blog-article-hero"><div className="container-site">
        <nav className="blog-breadcrumb" aria-label={zh ? "面包屑导航" : "Breadcrumb"}><Link href="/">{zh ? "首页" : "Home"}</Link><span>/</span><Link href="/blog">{zh ? "行业博客" : "Industry Blog"}</Link><span>/</span><span>{category.name}</span></nav>
        <Link href={`/blog?category=${category.slug}`} className="blog-tag">{category.name}</Link>
        <h1>{post.title}</h1><p>{post.excerpt}</p>
        <div className="blog-article-meta"><span>{zh ? "作者：" : "By "}{post.author || "Shanze Editorial"}</span><time dateTime={date.toISOString()}>{formatDate(date, locale)}</time><span><Clock3 size={15} />{readingMinutes(post.content)} {zh ? "分钟阅读" : "min read"}</span>{post.updatedAt.getTime() > date.getTime() + 86400000 && <span>{zh ? "更新于 " : "Updated "}<time dateTime={post.updatedAt.toISOString()}>{formatDate(post.updatedAt, locale)}</time></span>}</div>
      </div></header>
      <div className="container-site blog-article-layout">
        <div className="blog-article-main">{post.coverImage && <NewsCover src={cover} alt={post.title} priority />}<BlogContent blocks={blocks} /></div>
        <aside className="blog-article-sidebar">
          {headings.length > 0 && <nav className="blog-side-panel" aria-label={zh ? "文章目录" : "Table of contents"}><h2>{zh ? "文章目录" : "In this guide"}</h2><ol>{headings.map((heading) => heading.type === "heading" && <li key={heading.id}><a href={`#${heading.id}`}>{heading.text}</a></li>)}</ol></nav>}
          <div className="blog-side-panel blog-side-resources"><h2>{zh ? "制造与采购资源" : "Manufacturing resources"}</h2><Link href="/power-bank-manufacturer">{zh ? "充电宝制造商" : "Power Bank Manufacturer"}<ArrowRight size={14} /></Link><Link href="/magnetic-power-bank-oem">{zh ? "磁吸充电宝 OEM" : "Magnetic Power Bank OEM"}<ArrowRight size={14} /></Link><Link href="/wireless-charger-manufacturer">{zh ? "无线充电器制造商" : "Wireless Charger Manufacturer"}<ArrowRight size={14} /></Link><Link href="/custom-power-bank-supplier">{zh ? "定制充电宝供应商" : "Custom Power Bank Supplier"}<ArrowRight size={14} /></Link><Link href="/products">{zh ? "浏览产品" : "Browse products"}<ArrowRight size={14} /></Link><Link href="/contact#quote">{zh ? "咨询项目" : "Discuss your project"}<ArrowRight size={14} /></Link></div>
        </aside>
      </div>
    </article>
    <section className="container-site blog-related">{related.length > 0 && <><h2>{zh ? "相关采购指南" : "More sourcing guides"}</h2><div className="blog-card-grid">{related.map((item) => <article className="blog-card" key={item.id}><div className="blog-card-content"><h3><Link href={`/blog/${item.slug}`}>{item.title}</Link></h3><p>{item.excerpt}</p><Link className="text-link" href={`/blog/${item.slug}`}>{zh ? "阅读指南" : "Read guide"}<ArrowRight size={16} /></Link></div></article>)}</div></>}<div className="blog-project-cta"><div><h2>{zh ? "将指南转化为具体项目" : "Turn your sourcing checklist into a project brief"}</h2><p>{zh ? "告诉我们您的产品类型、目标市场、定制需求与计划数量。" : "Tell us your product type, target market, customization requirements and planned quantity."}</p></div><Link className="btn btn-primary" href="/contact#quote">{zh ? "提交询盘" : "Send Your RFQ"}<ArrowRight size={17} /></Link></div></section>
  </>;
}
