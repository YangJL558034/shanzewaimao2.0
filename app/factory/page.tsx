import { ClipboardCheck, Cog, Factory, FlaskConical, PackageCheck, ScanLine, Ship, Truck, UsersRound, Warehouse, Wrench } from "lucide-react";
import { SeoImage } from "@/components/public/SeoImage";
import { getOriginalImageSourceLookup } from "@/lib/image-seo-data";
import { db } from "@/lib/db";
import { Hero } from "@/components/public/Hero";
import { AutoScrollCarousel } from "@/components/public/AutoScrollCarousel";
import { StatGrid } from "@/components/public/StatGrid";
import { getSeoMetadata } from "@/lib/seo";
import { getLocale, translateEntities } from "@/lib/i18n";
import { getPageSectionMap } from "@/lib/page-content";
import "@/components/public/facility-cards.css";

function selectFacilityImage(primary: string | null | undefined, fallback: string | null | undefined, originalSource: (source: string) => string) {
  for (const value of [primary, fallback]) {
    if (!value?.trim()) continue;
    try {
      const source = new URL(value, "https://shanzesz.com");
      if (["http:", "https:"].includes(source.protocol) && !originalSource(source.pathname).startsWith("/references/")) return value;
    } catch { /* An absent or malformed picture uses a neutral icon instead. */ }
  }
  return "";
}

export const dynamic = "force-dynamic";
export async function generateMetadata() { return getSeoMetadata("/factory", { title: "Power Bank Factory in China | Shanze Manufacturing", description: "Explore Shanze charging product manufacturing equipment, production processes, workshop areas and quality-control support in China." }); }

export default async function FactoryPage() {
  const locale = await getLocale();
  const originalSource = await getOriginalImageSourceLookup();
  const facilityImage = (primary?: string | null, fallback?: string | null) => selectFacilityImage(primary, fallback, originalSource);
  const [rawEquipment, rawWorkshops, rawBanners, section] = await Promise.all([
    db.factoryEquipment.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } }),
    db.workshop.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } }),
    db.banner.findMany({ where: { page: "factory", status: "PUBLISHED" }, orderBy: { sortOrder: "asc" } }),
    getPageSectionMap("factory", locale),
  ]);
  const [equipment, workshops, banners] = await Promise.all([
    translateEntities("FactoryEquipment", rawEquipment, ["name", "description", "metric"], locale),
    translateEntities("Workshop", rawWorkshops, ["name", "description"], locale),
    translateEntities("Banner", rawBanners, ["title", "subtitle", "description", "ctaLabel"], locale),
  ]);
  const zh = locale === "zh";
  const banner = banners[0];
  const overview = section.overview;
  const stats = section.stats;
  const equipmentSection = section.equipment;
  const process = section.process;
  const workshopSection = section.workshop;
  const processIcons = [Wrench, ClipboardCheck, ScanLine, Cog, FlaskConical, Ship];
  const workshopIcons = [Factory, UsersRound, ScanLine, PackageCheck, Warehouse, Truck];
  const overviewImage = facilityImage(overview?.image);
  return <>
    <Hero page="factory" image={banner?.image} title={banner?.title || (zh ? "先进" : "Advanced")} accent={banner?.subtitle || (zh ? "智能制造基地" : "Manufacturing Facility")} subtitle={banner?.description || (zh ? "先进设备、智能生产系统和严格质量控制，为全球客户交付可靠充电解决方案。" : "State-of-the-art equipment, intelligent production systems and strict quality control deliver reliable charging solutions to customers worldwide.")} ctaLabel={banner?.ctaLabel || (zh ? "启动您的项目" : "Start Your Project")} ctaHref={banner?.ctaHref || "/contact"} slides={banners.map((item) => ({ id: item.id, image: item.image, title: item.title, accent: item.subtitle, subtitle: item.description || "", ctaLabel: item.ctaLabel || (zh ? "启动您的项目" : "Start Your Project"), ctaHref: item.ctaHref || "/contact" }))} />
    {overview && <section className="section"><div className="container-site split"><div className="image-window facility-overview-media">{overviewImage ? <SeoImage src={overviewImage} alt={overview.title} width="1200" height="800" loading="lazy" decoding="async" sizes="(max-width: 760px) 100vw, 50vw" /> : <Factory size={52} aria-hidden="true" />}</div><div><div className="eyebrow">{overview.subtitle}</div><h2 className="section-title">{overview.title}</h2><p className="section-copy whitespace-pre-line">{overview.content}</p><ul className="check-list">{overview.parsedItems.map((item, index) => <li key={`${item.title}-${index}`}>{item.title}<small>{item.text}</small></li>)}</ul></div></div>{stats && <div className="mt-10"><StatGrid items={stats.parsedItems.map((item) => [item.value || "", item.title || ""])} /></div>}</section>}
    {equipmentSection && <section className="section section-soft"><div className="container-site"><div className="center-head"><div className="eyebrow">{equipmentSection.subtitle}</div><h2 className="section-title">{equipmentSection.title}</h2><p>{equipmentSection.content}</p></div><AutoScrollCarousel label={zh ? "设备与机械自动轮播" : "Equipment and machinery carousel"} previousLabel={zh ? "查看上一台设备" : "Previous equipment"} nextLabel={zh ? "查看下一台设备" : "Next equipment"} itemsPerView={6} interval={2400}>{equipment.map((item) => {
      const image = facilityImage(item.image, equipmentSection.image);
      return <article className="card gallery-card factory-equipment-card facility-card" key={item.id}>
        <div className="factory-equipment-media facility-card-media is-equipment">{image
          ? <SeoImage src={image} alt={item.name} width="800" height="500" loading="lazy" decoding="async" sizes="(max-width: 640px) 86vw, (max-width: 960px) 50vw, 17vw" />
          : <span className="facility-card-placeholder" aria-hidden="true"><Wrench size={38} strokeWidth={1.5} /></span>}</div>
        <h3>{item.name}</h3><p>{item.description}</p>
      </article>;
    })}</AutoScrollCarousel></div></section>}
    {process && <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">{process.subtitle}</div><h2 className="section-title">{process.title}</h2><p>{process.content}</p></div><div className="process">{process.parsedItems.map((item, index) => { const Icon = processIcons[index % processIcons.length]; return <div className="process-step" key={`${item.title}-${index}`}>{item.image ? <SeoImage className="process-image" src={item.image} alt="" /> : <span className="icon-badge"><Icon size={22} /></span>}<strong>{index + 1}. {item.title}</strong><small>{item.text}</small></div>; })}</div></div></section>}
    {workshopSection && <section className="section section-soft"><div className="container-site"><div className="center-head"><div className="eyebrow">{workshopSection.subtitle}</div><h2 className="section-title">{workshopSection.title}</h2><p>{workshopSection.content}</p></div><AutoScrollCarousel label={zh ? "车间环境自动轮播" : "Workshop environment carousel"} previousLabel={zh ? "查看上一个车间区域" : "Previous workshop area"} nextLabel={zh ? "查看下一个车间区域" : "Next workshop area"} itemsPerView={6} interval={2600}>{workshops.map((item, index) => {
      const Icon = workshopIcons[index % workshopIcons.length];
      const image = facilityImage(item.image, workshopSection.image);
      return <article className="card gallery-card factory-workshop-card facility-card" key={item.id}>
        <div className={`card-art factory-workshop-art facility-card-media is-workshop${originalSource(image).includes("/company-profile/") ? " is-original" : ""}`}>{image
          ? <SeoImage src={image} alt={item.name} width="800" height="500" loading="lazy" decoding="async" sizes="(max-width: 640px) 86vw, (max-width: 960px) 50vw, 17vw" />
          : <span className="facility-card-placeholder" aria-hidden="true"><Icon size={38} strokeWidth={1.5} /></span>}</div>
        <h3>{item.name}</h3><p>{item.description}</p>
      </article>;
    })}</AutoScrollCarousel></div></section>}
  </>;
}
