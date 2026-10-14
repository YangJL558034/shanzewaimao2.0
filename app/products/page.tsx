import { BriefcaseBusiness, Headphones, House, Plane, Smartphone, Store } from "lucide-react";
import { SeoImage } from "@/components/public/SeoImage";
import Link from "next/link";
import { db } from "@/lib/db";
import { Hero } from "@/components/public/Hero";
import { ProductsCatalog } from "@/components/public/ProductsCatalog";
import { getSeoMetadata, safeCanonicalUrl } from "@/lib/seo";
import { getLocale, translateEntities } from "@/lib/i18n";
import { getPageSectionMap } from "@/lib/page-content";
import { JsonLd } from "@/components/public/JsonLd";
import { absoluteUrl } from "@/lib/utils";
import "./product-seo.css";

type ProductQuery = { category?: string | string[] };
const firstCategory = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] || "" : value || "").trim().slice(0, 120);
export async function generateMetadata({ searchParams }: { searchParams: Promise<ProductQuery> }) {
  const category = firstCategory((await searchParams).category);
  const metadata = await getSeoMetadata("/products", { title: "Power Banks & Wireless Chargers | OEM/ODM Products | Shanze", description: "Compare Shanze power banks, magnetic power banks and wireless chargers for OEM/ODM sourcing. Review models and request branding, packaging and bulk-order quotes." });
  return category ? { ...metadata, robots: { index: false, follow: true }, alternates: { canonical: safeCanonicalUrl("/products") } } : metadata;
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<ProductQuery> }) {
  const category = firstCategory((await searchParams).category);
  const locale = await getLocale();
  const [categories, products, rawBanners, section] = await Promise.all([
    db.productCategory.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } }),
    db.product.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }] }),
    db.banner.findMany({ where: { page: "products", status: "PUBLISHED" }, orderBy: { sortOrder: "asc" } }),
    getPageSectionMap("products", locale),
  ]);
  const [localizedCategories, localizedProducts, banners] = await Promise.all([
    translateEntities("ProductCategory", categories, ["name", "description"], locale),
    translateEntities("Product", products, ["name", "features"], locale),
    translateEntities("Banner", rawBanners, ["title", "subtitle", "description", "ctaLabel"], locale),
  ]);
  const zh = locale === "zh";
  const banner = banners[0];
  const categoriesSection = section.categories;
  const featured = section.featured;
  const applications = section.applications;
  const customization = section.customization;
  const catalog = section.catalog;
  const icons = [Smartphone, Headphones, BriefcaseBusiness, Plane, Store, House];
  const sourcingLinks = [
    { href: "/power-bank-manufacturer", title: zh ? "充电宝制造商" : "Power Bank Manufacturer", text: zh ? "根据目标容量、接口和采购需求评审充电宝型号。" : "Compare model specifications, capacity targets and OEM project requirements." },
    { href: "/magnetic-power-bank-oem", title: zh ? "磁吸充电宝 OEM" : "Magnetic Power Bank OEM", text: zh ? "确认设备适配、品牌展示、包装与样品评审需求。" : "Plan device compatibility, branding, packaging and sample evaluation." },
    { href: "/wireless-charger-manufacturer", title: zh ? "无线充电器制造商" : "Wireless Charger Manufacturer", text: zh ? "按照设备组合、使用场景和充电要求评审产品。" : "Review device combinations, use cases and charging requirements." },
    { href: "/custom-power-bank-supplier", title: zh ? "定制充电宝供应商" : "Custom Power Bank Supplier", text: zh ? "整理定制范围、订单数量、文件与交付要求。" : "Define your customization brief, quantity, documents and delivery plan." },
  ];
  return <>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: "Products", item: absoluteUrl("/products") }] }} />
    <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", "@id": `${absoluteUrl("/products")}#catalog`, name: zh ? "Shanze 充电产品" : "Shanze Power Banks & Wireless Chargers", url: absoluteUrl("/products"), mainEntity: { "@type": "ItemList", itemListElement: localizedProducts.map((product, index) => ({ "@type": "ListItem", position: index + 1, name: product.name, url: absoluteUrl(`/products/${product.slug}`) })) } }} />
    <Hero page="products" image={banner?.image} title={banner?.title || (zh ? "充电宝与无线充电器" : "Power Banks & Wireless Chargers")} accent={banner?.subtitle || (zh ? "OEM/ODM 产品采购" : "for OEM/ODM Sourcing")} subtitle={banner?.description || (zh ? "按型号比较产品规格，确认品牌、包装和目标市场需求，并获取项目报价。" : "Compare model specifications, define branding and packaging requirements, and request a quote for your target market.")} ctaLabel={banner?.ctaLabel || (zh ? "获取报价" : "Get a Quote")} ctaHref={banner?.ctaHref || "/contact#quote"} slides={banners.map((item) => ({ id: item.id, image: item.image, title: item.title, accent: item.subtitle, subtitle: item.description || "", ctaLabel: item.ctaLabel || (zh ? "获取报价" : "Get a Quote"), ctaHref: item.ctaHref || "/contact#quote" }))} />
    <ProductsCatalog categories={localizedCategories} products={localizedProducts} categoriesSection={categoriesSection || { title: zh ? "按产品类型采购" : "Browse by Product Type", subtitle: "OEM / ODM", content: zh ? "选择产品类型，比较已发布的型号与规格。" : "Select a category to compare published models and specifications.", buttonLabel: null }} featuredSection={featured || { title: zh ? "产品型号" : "Product Models", subtitle: null, content: zh ? "查看产品规格和可评审的定制选项。" : "Review product specifications and model-specific customization options.", buttonLabel: null }} initialCategory={category} labels={{ categoryFallback: zh ? "分类" : "Category", products: zh ? "产品" : "Products", viewMore: zh ? "查看更多" : "View More", viewDetails: zh ? "查看详情" : "View Details", new: zh ? "新品" : "NEW", empty: zh ? "该分类暂时没有已发布产品。" : "No published products in this category yet." }} />
    <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">{zh ? "B2B 项目选型" : "B2B Project Sourcing"}</div><h2 className="section-title">{zh ? "为您的采购项目选择方案" : "Choose a Sourcing Path for Your Project"}</h2><p>{zh ? "从产品类型进入制造商采购指南，确认配置与采购要求。" : "Explore manufacturing and sourcing guides to define your product configuration and buying requirements."}</p></div><div className="products-sourcing-grid">{sourcingLinks.map((item) => <Link className="card" href={item.href} key={item.href}><h3>{item.title}</h3><p>{item.text}</p><span>{zh ? "查看采购方案" : "Explore the Sourcing Guide"} →</span></Link>)}</div><div className="product-sourcing-links"><Link href="/blog">{zh ? "行业与 OEM 采购博客" : "Industry & OEM Sourcing Blog"} →</Link><Link href="/factory">{zh ? "工厂与生产能力" : "Factory & Production"} →</Link><Link href="/quality">{zh ? "质量与文件评审" : "Quality & Documentation"} →</Link></div></div></section>
    {applications && <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">{applications.subtitle}</div><h2 className="section-title">{applications.title}</h2><p>{applications.content}</p></div><div className="grid-cards grid-cols-2 md:grid-cols-6">{applications.parsedItems.map((item, index) => { const Icon = icons[index % icons.length]; return <div className="feature-card" key={`${item.title}-${index}`}>{item.image ? <SeoImage sizes="(max-width: 760px) 50vw, 17vw" className="application-image" src={item.image} alt={`${item.title} ${zh ? "充电产品应用" : "charging product application"}`} loading="lazy" /> : <Icon className="mx-auto text-brand-600" aria-hidden="true" />}<h3>{item.title}</h3><p>{item.text}</p></div>; })}</div></div></section>}
    {(customization || catalog) && <section className="section section-soft"><div className="container-site split">
      {customization && <div className="rounded-lg bg-gradient-to-r from-blue-700 to-blue-500 p-9 text-white"><div className="eyebrow !text-blue-100">{customization.subtitle}</div><h2 className="section-title">{customization.title}</h2><p>{customization.content}</p>{customization.buttonLabel && <Link href={customization.buttonHref || "/contact"} className="btn mt-5 bg-white text-brand-600">{customization.buttonLabel} →</Link>}</div>}
      {catalog && <div className="rounded-lg border bg-white p-9"><div className="eyebrow">{catalog.subtitle}</div><h2 className="section-title">{catalog.title}</h2><p className="muted">{catalog.content}</p>{catalog.image && <SeoImage sizes="(max-width: 760px) 100vw, 50vw" className="catalog-section-image" src={catalog.image} alt={zh ? "Shanze 充电产品 OEM/ODM 目录" : "Shanze power bank and wireless charger OEM/ODM product catalog"} loading="lazy" />}{catalog.buttonLabel && <a href={catalog.buttonHref || "/api/downloads/catalog"} className="btn btn-primary mt-5" download>{catalog.buttonLabel} (PDF)</a>}</div>}
    </div></section>}
  </>;
}
