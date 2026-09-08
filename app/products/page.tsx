import { BriefcaseBusiness, Headphones, House, Plane, Smartphone, Store } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { Hero } from "@/components/public/Hero";
import { ProductsCatalog } from "@/components/public/ProductsCatalog";
import { getSeoMetadata } from "@/lib/seo";
import { getLocale, translateEntities } from "@/lib/i18n";
import { getPageSectionMap } from "@/lib/page-content";

export async function generateMetadata() { return getSeoMetadata("/products", { title: "Charging Products", description: "Explore certified magnetic power banks, wireless chargers, charging accessories and custom OEM/ODM solutions." }); }

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
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
  return <>
    <Hero page="products" image={banner?.image} title={banner?.title || (zh ? "充电产品" : "Charging Products")} accent={banner?.subtitle || (zh ? "服务全球市场" : "for Global Markets")} subtitle={banner?.description || (zh ? "创新、认证且可靠的充电解决方案，服务全球品牌客户。" : "Innovative, certified and reliable charging solutions engineered for performance, safety and design.")} ctaLabel={banner?.ctaLabel || (zh ? "获取报价" : "Get a Quote")} ctaHref={banner?.ctaHref || "/contact#quote"} slides={banners.map((item) => ({ id: item.id, image: item.image, title: item.title, accent: item.subtitle, subtitle: item.description || "", ctaLabel: item.ctaLabel || (zh ? "获取报价" : "Get a Quote"), ctaHref: item.ctaHref || "/contact#quote" }))} />
    {categoriesSection && featured && <ProductsCatalog categories={localizedCategories} products={localizedProducts} categoriesSection={categoriesSection} featuredSection={featured} initialCategory={category} labels={{ categoryFallback: zh ? "分类" : "Category", products: zh ? "产品" : "Products", viewMore: zh ? "查看更多" : "View More", viewDetails: zh ? "查看详情" : "View Details", new: zh ? "新品" : "NEW", empty: zh ? "该分类暂时没有已发布产品。" : "No published products in this category yet." }} />}
    {applications && <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">{applications.subtitle}</div><h2 className="section-title">{applications.title}</h2><p>{applications.content}</p></div><div className="grid-cards grid-cols-2 md:grid-cols-6">{applications.parsedItems.map((item, index) => { const Icon = icons[index % icons.length]; return <div className="feature-card" key={`${item.title}-${index}`}>{item.image ? <img className="application-image" src={item.image} alt="" /> : <Icon className="mx-auto text-brand-600" />}<strong>{item.title}</strong><p>{item.text}</p></div>; })}</div></div></section>}
    {(customization || catalog) && <section className="section section-soft"><div className="container-site split">
      {customization && <div className="rounded-lg bg-gradient-to-r from-blue-700 to-blue-500 p-9 text-white"><div className="eyebrow !text-blue-100">{customization.subtitle}</div><h2 className="section-title">{customization.title}</h2><p>{customization.content}</p>{customization.buttonLabel && <Link href={customization.buttonHref || "/contact"} className="btn mt-5 bg-white text-brand-600">{customization.buttonLabel} →</Link>}</div>}
      {catalog && <div className="rounded-lg border bg-white p-9"><div className="eyebrow">{catalog.subtitle}</div><h2 className="section-title">{catalog.title}</h2><p className="muted">{catalog.content}</p>{catalog.image && <img className="catalog-section-image" src={catalog.image} alt="" />}{catalog.buttonLabel && <a href={catalog.buttonHref || "/api/downloads/catalog"} className="btn btn-primary mt-5" download>{catalog.buttonLabel} (PDF)</a>}</div>}
    </div></section>}
  </>;
}
