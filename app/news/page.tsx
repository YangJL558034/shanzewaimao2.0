import Link from "next/link";
import { Mail, Search } from "lucide-react";
import { db } from "@/lib/db";
import { Hero } from "@/components/public/Hero";
import { NewsletterForm } from "@/components/public/NewsletterForm";
import { formatDate } from "@/lib/utils";
import { getSeoMetadata } from "@/lib/seo";
import { getLocale, translateEntities } from "@/lib/i18n";
import { getPageSectionMap } from "@/lib/page-content";
import { permanentRedirect } from "next/navigation";
import { blogCategorySlugs, isBlogCategorySlug } from "@/lib/blog";
import { seoPageDefaults } from "@/lib/seo-defaults";
import { NewsCover } from "@/components/public/NewsCover";

type NewsQuery = { category?: string | string[]; q?: string | string[] };
const firstQuery = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] || "" : value || "").trim().slice(0, 120);
export async function generateMetadata({ searchParams }: { searchParams: Promise<NewsQuery> }) { const params = await searchParams; const metadata = await getSeoMetadata("/news", seoPageDefaults["/news"]); return firstQuery(params.category) || firstQuery(params.q) ? { ...metadata, robots: { index: false, follow: true } } : metadata; }

export default async function NewsPage({ searchParams }: { searchParams: Promise<NewsQuery> }) {
  const params = await searchParams;
  const category = firstQuery(params.category);
  const q = firstQuery(params.q);
  if (category && isBlogCategorySlug(category)) permanentRedirect(`/blog?category=${encodeURIComponent(category)}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const locale = await getLocale();
  const [categories, posts, rawBanners, section] = await Promise.all([
    db.newsCategory.findMany({ where: { slug: { notIn: [...blogCategorySlugs] } }, orderBy: { sortOrder: "asc" }, include: { _count: { select: { posts: { where: { status: "PUBLISHED" } } } } } }),
    db.news.findMany({ where: { status: "PUBLISHED", category: { slug: category || { notIn: [...blogCategorySlugs] } }, ...(q ? { title: { contains: q } } : {}) }, orderBy: { publishedAt: "desc" }, include: { category: true } }),
    db.banner.findMany({ where: { page: "news", status: "PUBLISHED" }, orderBy: { sortOrder: "asc" } }),
    getPageSectionMap("news", locale),
  ]);
  const [localizedCategories, localizedPosts, banners] = await Promise.all([
    translateEntities("NewsCategory", categories, ["name"], locale),
    translateEntities("News", posts, ["title", "excerpt", "content"], locale),
    translateEntities("Banner", rawBanners, ["title", "subtitle", "description", "ctaLabel"], locale),
  ]);
  const zh = locale === "zh";
  const banner = banners[0];
  const listing = section.listing;
  const newsletter = section.newsletter;
  return <>
    <div className="container-site py-3 text-sm"><Link className="text-link" href="/blog">{zh ? "寻找 OEM 采购指南？阅读行业博客 →" : "Looking for OEM sourcing guidance? Explore the Industry Blog →"}</Link></div>
    <Hero page="news" image={banner?.image} title={banner?.title || (zh ? "新闻与洞察" : "News & Insights")} accent={banner?.subtitle} subtitle={banner?.description || (zh ? "了解山泽新能源科技最新产品动态、行业洞察和公司里程碑。" : "Stay up to date with the latest news, product updates, industry insights and company milestones from Shanze.")} ctaLabel={banner?.ctaLabel || (zh ? "联系我们" : "Contact Us")} ctaHref={banner?.ctaHref || "/contact"} slides={banners.map((item) => ({ id: item.id, image: item.image, title: item.title, accent: item.subtitle, subtitle: item.description || "", ctaLabel: item.ctaLabel || (zh ? "联系我们" : "Contact Us"), ctaHref: item.ctaHref || "/contact" }))} />
    {listing && <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">{listing.subtitle}</div><h2 className="section-title">{listing.title}</h2><p>{listing.content}</p></div><div className="search-bar"><div className="tabs"><Link className={`tab ${!category ? "active" : ""}`} href="/news">{zh ? "全部新闻" : "All News"}</Link>{localizedCategories.map((item) => <Link className={`tab ${category === item.slug ? "active" : ""}`} href={`/news?category=${item.slug}`} key={item.id}>{item.name}</Link>)}</div><form className="flex"><input className="rounded-l border px-3" name="q" defaultValue={q} placeholder={zh ? "搜索新闻…" : "Search news..."} aria-label="Search news" /><button className="rounded-r border border-l-0 px-3" aria-label="Search"><Search size={17} /></button></form></div><div className="news-layout"><div className="grid-cards news-grid">{localizedPosts.map((post) => <article className="card news-card" key={post.id}><Link href={`/news/${post.slug}`} tabIndex={-1} aria-hidden="true"><NewsCover src={post.coverImage} alt={post.title} /></Link><div className="card-body"><time>{formatDate(post.publishedAt)}</time><h3>{post.title}</h3><p>{post.excerpt}</p><Link className="text-link" href={`/news/${post.slug}`}>{listing.buttonLabel || (zh ? "阅读全文" : "Read More")} →</Link></div></article>)}</div><aside>{newsletter && <div className="card sidebar-card text-center"><span className="icon-badge mx-auto mb-3"><Mail /></span><div className="eyebrow">{newsletter.subtitle}</div><h3>{newsletter.title}</h3><p className="muted">{newsletter.content}</p><NewsletterForm locale={locale} /></div>}<div className="card sidebar-card"><h3>{zh ? "新闻分类" : "Categories"}</h3><ul className="check-list">{localizedCategories.map((item) => <li key={item.id}><Link href={`/news?category=${item.slug}`}>{item.name} ({item._count.posts})</Link></li>)}</ul></div></aside></div></div></section>}
  </>;
}
