import Link from "next/link";
import { Boxes, FileText, Globe2, Newspaper } from "lucide-react";

import { db } from "@/lib/db";
import { getLocale, translateEntities } from "@/lib/i18n";
import { getSeoMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return getSeoMetadata("/site-map", { title: "Sitemap", description: "Browse all major website pages, products and company updates." });
}

export default async function SiteMapPage() {
  const locale = await getLocale();
  const zh = locale === "zh";
  const [rawNavigation, rawCategories, rawProducts, rawNews] = await Promise.all([
    db.navigationItem.findMany({ where: { location: "HEADER", isVisible: true }, orderBy: { sortOrder: "asc" } }),
    db.productCategory.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } }),
    db.product.findMany({ where: { status: "PUBLISHED" }, orderBy: { sortOrder: "asc" }, take: 100 }),
    db.news.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 100 }),
  ]);
  const [navigation, categories, products, news] = await Promise.all([
    translateEntities("NavigationItem", rawNavigation, ["label"], locale),
    translateEntities("ProductCategory", rawCategories, ["name"], locale),
    translateEntities("Product", rawProducts, ["name"], locale),
    translateEntities("News", rawNews, ["title"], locale),
  ]);
  const mainLinks = [
    ...navigation.map((item) => ({ label: item.label, href: item.href })),
    { label: zh ? "隐私政策" : "Privacy Policy", href: "/privacy-policy" },
    { label: zh ? "使用条款" : "Terms of Use", href: "/terms-of-use" },
  ];
  const groups = [
    { title: zh ? "主要页面" : "Main Pages", Icon: Globe2, links: mainLinks },
    { title: zh ? "产品分类" : "Product Categories", Icon: Boxes, links: categories.map((item) => ({ label: item.name, href: `/products?category=${item.slug}` })) },
    { title: zh ? "产品详情" : "Products", Icon: FileText, links: products.map((item) => ({ label: item.name, href: `/products/${item.slug}` })) },
    { title: zh ? "新闻资讯" : "News & Insights", Icon: Newspaper, links: news.map((item) => ({ label: item.title, href: `/news/${item.slug}` })) },
  ];
  return <>
    <section className="legal-page-hero"><div className="container-site"><span className="legal-page-icon"><Globe2 size={24} /></span><div><div className="eyebrow">{zh ? "网站导航" : "Website Directory"}</div><h1>{zh ? "网站地图" : "Sitemap"}</h1><p>{zh ? "快速浏览公司页面、产品分类、产品详情和新闻资讯。" : "Quickly browse company pages, product categories, products and news."}</p></div></div></section>
    <section className="section"><div className="container-site site-map-grid">{groups.map(({ title, Icon, links }) => <section className="card sitemap-group" key={title}><div className="sitemap-group-title"><span className="icon-badge"><Icon size={18} /></span><h2>{title}</h2></div><ul>{links.map((item) => <li key={`${item.href}-${item.label}`}><Link href={item.href}>{item.label}<span>→</span></Link></li>)}</ul></section>)}</div></section>
  </>;
}
