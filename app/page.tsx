import Link from "next/link";
import { db } from "@/lib/db";
import { Hero } from "@/components/public/Hero";
import { CategoryCard, CategoryCards, FeatureCards } from "@/components/public/ContentCards";
import { StatGrid } from "@/components/public/StatGrid";
import { JsonLd } from "@/components/public/JsonLd";
import { AutoScrollCarousel } from "@/components/public/AutoScrollCarousel";
import { getSeoMetadata } from "@/lib/seo";
import { getLocale, translateEntities } from "@/lib/i18n";
import { getPageSectionMap } from "@/lib/page-content";

export const revalidate = 60;
export async function generateMetadata() { return getSeoMetadata("/", { title: "Power Bank Manufacturer in China | OEM/ODM Charging Solutions | Shanze", description: "Shanze is a professional power bank and wireless charger manufacturer in China, providing OEM/ODM magnetic power banks, semi-solid-state power banks and custom charging solutions for global brands." }); }

export default async function HomePage() {
  const locale = await getLocale();
  const [banners, categories, equipment, workshops, certificates, section] = await Promise.all([
    db.banner.findMany({ where: { page: "home", status: "PUBLISHED" }, orderBy: { sortOrder: "asc" } }),
    db.productCategory.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } }),
    db.factoryEquipment.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } }),
    db.workshop.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } }),
    db.certificate.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" }, take: 5 }),
    getPageSectionMap("home", locale),
  ]);
  const [localizedBanners, localizedCategories, localizedEquipment, localizedWorkshops] = await Promise.all([
    translateEntities("Banner", banners, ["title", "subtitle", "description", "ctaLabel"], locale),
    translateEntities("ProductCategory", categories, ["name", "description"], locale),
    translateEntities("FactoryEquipment", equipment, ["name", "description", "metric"], locale),
    translateEntities("Workshop", workshops, ["name", "description"], locale),
  ]);
  const zh = locale === "zh";
  const banner = localizedBanners[0];
  return <>
    <JsonLd data={{ "@context": "https://schema.org", "@graph": [{ "@type": "Organization", "@id": "https://shanzesz.com/#organization", name: "Shanze New Energy Technology Co., Ltd.", alternateName: "Shanze", url: "https://shanzesz.com/", email: "sales@shanzesz.com", description: "Power bank and wireless charger OEM/ODM manufacturer in China.", address: { "@type": "PostalAddress", addressLocality: "Shenzhen", addressCountry: "CN" } }, { "@type": "WebSite", "@id": "https://shanzesz.com/#website", url: "https://shanzesz.com/", name: "Shanze", publisher: { "@id": "https://shanzesz.com/#organization" } }] }} />
    <Hero page="home" image={banner?.image} title={zh ? "专业充电宝制造商" : "Professional Power Bank Manufacturer"} accent={zh ? "OEM/ODM 供应商" : "& OEM/ODM Supplier"} subtitle={zh ? "为全球品牌定制磁吸充电宝、半固态充电宝和无线充电产品。" : "Custom Magnetic Power Banks, Semi-Solid-State Power Banks and Wireless Charging Products for Global Brands."} ctaLabel={banner?.ctaLabel || (zh ? "获取报价" : "Get a Quote")} ctaHref={banner?.ctaHref || "/contact#quote"} slides={localizedBanners.map((item) => ({ id: item.id, image: item.image, title: zh ? "专业充电宝制造商" : "Professional Power Bank Manufacturer", accent: zh ? "OEM/ODM 供应商" : "& OEM/ODM Supplier", subtitle: zh ? "为全球品牌定制磁吸充电宝、半固态充电宝和无线充电产品。" : "Custom Magnetic Power Banks, Semi-Solid-State Power Banks and Wireless Charging Products for Global Brands.", ctaLabel: item.ctaLabel || (zh ? "获取报价" : "Get a Quote"), ctaHref: item.ctaHref || "/contact#quote" }))} />
    {section.about && <section className="section"><div className="container-site split"><div className="image-window" style={{ "--crop-image": `url(${section.about.image || "/references/home.png"})`, "--crop-position": section.about.image ? "center" : "-10px -420px" } as React.CSSProperties} /><div><div className="eyebrow">{section.about.subtitle}</div><h2 className="section-title">{section.about.title}</h2><p className="section-copy whitespace-pre-line">{section.about.content}</p><ul className="check-list">{section.about.parsedItems.map((item, index) => <li key={`${item.title}-${index}`}>{item.title}<small>{item.text}</small></li>)}</ul>{section.about.buttonLabel && <Link href={section.about.buttonHref || "/about"} className="text-link">{section.about.buttonLabel} →</Link>}</div></div></section>}
    {section.stats && <section className="section-soft py-12"><div className="container-site"><StatGrid items={section.stats.parsedItems.map((item) => [item.value || "", item.title || ""])} /></div></section>}
    {section.products && <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">{section.products.subtitle}</div><h2 className="section-title">{section.products.title}</h2><p>{section.products.content}</p></div>{localizedCategories.length > 5 ? <AutoScrollCarousel label={zh ? "产品分类轮播" : "Product category carousel"} previousLabel={zh ? "查看上一个产品分类" : "Previous product category"} nextLabel={zh ? "查看下一个产品分类" : "Next product category"} itemsPerView={5} interval={2600}>{localizedCategories.map((category, index) => <CategoryCard category={category} index={index} viewLabel={section.products.buttonLabel || (zh ? "查看更多" : "View More")} key={category.id} />)}</AutoScrollCarousel> : <CategoryCards categories={localizedCategories} viewLabel={section.products.buttonLabel || (zh ? "查看更多" : "View More")} />}</div></section>}
    {section.equipment && <section className="section section-soft"><div className="container-site"><div className="center-head"><div className="eyebrow">{section.equipment.subtitle}</div><h2 className="section-title">{section.equipment.title}</h2><p>{section.equipment.content}</p></div><div className="home-auto-gallery"><AutoScrollCarousel label={zh ? "先进生产设备自动轮播" : "Advanced production equipment carousel"} previousLabel={zh ? "查看上一台生产设备" : "Previous production equipment"} nextLabel={zh ? "查看下一台生产设备" : "Next production equipment"} itemsPerView={4} interval={2400}>{localizedEquipment.map((item, index) => <article className="card gallery-card" key={item.id}><div className="card-art" style={{ "--art-image": `url(${item.image || section.equipment.image || "/references/home.png"})`, "--art-position": item.image ? "center" : `${index * 20}% -770px` } as React.CSSProperties} /><h3>{item.name}</h3><p>{item.description}</p></article>)}</AutoScrollCarousel></div></div></section>}
    {section.workshop && <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">{section.workshop.subtitle}</div><h2 className="section-title">{section.workshop.title}</h2><p>{section.workshop.content}</p></div><div className="home-auto-gallery"><AutoScrollCarousel label={zh ? "整洁有序的车间环境自动轮播" : "Clean and organized workshop carousel"} previousLabel={zh ? "查看上一个车间环境" : "Previous workshop environment"} nextLabel={zh ? "查看下一个车间环境" : "Next workshop environment"} itemsPerView={4} interval={2600}>{localizedWorkshops.map((item, index) => <article className="card gallery-card" key={item.id}><div className="card-art" style={{ "--art-image": `url(${item.image || section.workshop.image || "/references/home.png"})`, "--art-position": item.image ? "center" : `${index * 25}% -940px` } as React.CSSProperties} /><h3>{item.name}</h3><p>{item.description}</p></article>)}</AutoScrollCarousel></div></div></section>}
    {section.quality && <section className="section section-soft"><div className="container-site"><div className="center-head"><div className="eyebrow">{section.quality.subtitle}</div><h2 className="section-title">{section.quality.title}</h2><p>{section.quality.content}</p><div className="mt-6 flex flex-wrap justify-center gap-3">{certificates.map((certificate) => <span key={certificate.id} className="rounded border border-blue-200 bg-white px-5 py-3 font-extrabold">{certificate.name}</span>)}</div></div><FeatureCards features={section.quality.parsedItems.map((item) => ({ title: item.title || "", text: item.text || "" }))} /></div></section>}
  </>;
}
