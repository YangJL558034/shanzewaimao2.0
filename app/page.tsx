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
export async function generateMetadata() {
  const [seo, company] = await Promise.all([getSeoMetadata("/", { title: "Shanze New Energy Technology Co., Ltd.", description: "Certified OEM/ODM manufacturer of charging products for global B2B buyers." }), db.setting.findUnique({ where: { key: "company_name" } }).catch(() => null)]);
  return { ...seo, title: { absolute: company?.value || "Shanze New Energy Technology Co., Ltd." } };
}

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
    <JsonLd data={{ "@context": "https://schema.org", "@type": "Organization", name: "ENERCORE Technology Co., Ltd.", url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000", email: "sales@enercore.com", telephone: "+86 755 8888 9999", description: "OEM/ODM charging products manufacturer", address: { "@type": "PostalAddress", addressLocality: "Shenzhen", addressCountry: "CN" } }} />
    <Hero page="home" image={banner?.image} title={banner?.title || (zh ? "可靠制造，成就创新" : "Reliable Manufacturing for Innovative")} accent={banner?.subtitle || (zh ? "充电产品" : "Charging Products")} subtitle={banner?.description || (zh ? "专业 OEM/ODM 服务、严格质量控制与可靠的全球出口经验。" : "Professional OEM/ODM service, strict quality control, and reliable global export experience.")} ctaLabel={banner?.ctaLabel || (zh ? "了解更多" : "Learn More")} ctaHref={banner?.ctaHref || "/about"} slides={localizedBanners.map((item) => ({ id: item.id, image: item.image, title: item.title || "", accent: item.subtitle, subtitle: item.description || "", ctaLabel: item.ctaLabel || (zh ? "了解更多" : "Learn More"), ctaHref: item.ctaHref || "/about" }))} />
    {section.about && <section className="section"><div className="container-site split"><div className="image-window" style={{ "--crop-image": `url(${section.about.image || "/references/home.png"})`, "--crop-position": section.about.image ? "center" : "-10px -420px" } as React.CSSProperties} /><div><div className="eyebrow">{section.about.subtitle}</div><h2 className="section-title">{section.about.title}</h2><p className="section-copy whitespace-pre-line">{section.about.content}</p><ul className="check-list">{section.about.parsedItems.map((item, index) => <li key={`${item.title}-${index}`}>{item.title}<small>{item.text}</small></li>)}</ul>{section.about.buttonLabel && <Link href={section.about.buttonHref || "/about"} className="text-link">{section.about.buttonLabel} →</Link>}</div></div></section>}
    {section.stats && <section className="section-soft py-12"><div className="container-site"><StatGrid items={section.stats.parsedItems.map((item) => [item.value || "", item.title || ""])} /></div></section>}
    {section.products && <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">{section.products.subtitle}</div><h2 className="section-title">{section.products.title}</h2><p>{section.products.content}</p></div>{localizedCategories.length > 5 ? <AutoScrollCarousel label={zh ? "产品分类轮播" : "Product category carousel"} previousLabel={zh ? "查看上一个产品分类" : "Previous product category"} nextLabel={zh ? "查看下一个产品分类" : "Next product category"} itemsPerView={5} interval={2600}>{localizedCategories.map((category, index) => <CategoryCard category={category} index={index} viewLabel={section.products.buttonLabel || (zh ? "查看更多" : "View More")} key={category.id} />)}</AutoScrollCarousel> : <CategoryCards categories={localizedCategories} viewLabel={section.products.buttonLabel || (zh ? "查看更多" : "View More")} />}</div></section>}
    {section.equipment && <section className="section section-soft"><div className="container-site"><div className="center-head"><div className="eyebrow">{section.equipment.subtitle}</div><h2 className="section-title">{section.equipment.title}</h2><p>{section.equipment.content}</p></div><div className="home-auto-gallery"><AutoScrollCarousel label={zh ? "先进生产设备自动轮播" : "Advanced production equipment carousel"} previousLabel={zh ? "查看上一台生产设备" : "Previous production equipment"} nextLabel={zh ? "查看下一台生产设备" : "Next production equipment"} itemsPerView={4} interval={2400}>{localizedEquipment.map((item, index) => <article className="card gallery-card" key={item.id}><div className="card-art" style={{ "--art-image": `url(${item.image || section.equipment.image || "/references/home.png"})`, "--art-position": item.image ? "center" : `${index * 20}% -770px` } as React.CSSProperties} /><h3>{item.name}</h3><p>{item.description}</p></article>)}</AutoScrollCarousel></div></div></section>}
    {section.workshop && <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">{section.workshop.subtitle}</div><h2 className="section-title">{section.workshop.title}</h2><p>{section.workshop.content}</p></div><div className="home-auto-gallery"><AutoScrollCarousel label={zh ? "整洁有序的车间环境自动轮播" : "Clean and organized workshop carousel"} previousLabel={zh ? "查看上一个车间环境" : "Previous workshop environment"} nextLabel={zh ? "查看下一个车间环境" : "Next workshop environment"} itemsPerView={4} interval={2600}>{localizedWorkshops.map((item, index) => <article className="card gallery-card" key={item.id}><div className="card-art" style={{ "--art-image": `url(${item.image || section.workshop.image || "/references/home.png"})`, "--art-position": item.image ? "center" : `${index * 25}% -940px` } as React.CSSProperties} /><h3>{item.name}</h3><p>{item.description}</p></article>)}</AutoScrollCarousel></div></div></section>}
    {section.quality && <section className="section section-soft"><div className="container-site"><div className="center-head"><div className="eyebrow">{section.quality.subtitle}</div><h2 className="section-title">{section.quality.title}</h2><p>{section.quality.content}</p><div className="mt-6 flex flex-wrap justify-center gap-3">{certificates.map((certificate) => <span key={certificate.id} className="rounded border border-blue-200 bg-white px-5 py-3 font-extrabold">{certificate.name}</span>)}</div></div><FeatureCards features={section.quality.parsedItems.map((item) => ({ title: item.title || "", text: item.text || "" }))} /></div></section>}
  </>;
}
