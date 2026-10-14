import { SeoImage } from "@/components/public/SeoImage";
import { getOriginalImageSourceLookup } from "@/lib/image-seo-data";
import { CheckCircle2, PackageCheck, Search, Settings, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { Hero } from "@/components/public/Hero";
import { FeatureCards } from "@/components/public/ContentCards";
import { AutoScrollCarousel } from "@/components/public/AutoScrollCarousel";
import { getSeoMetadata } from "@/lib/seo";
import { getLocale, translateEntities } from "@/lib/i18n";
import { getPageSectionMap } from "@/lib/page-content";
import { CertificateGallery } from "@/components/public/CertificateGallery";
import styles from "./quality-media.module.css";

export const dynamic = "force-dynamic";
export async function generateMetadata() { return getSeoMetadata("/quality", { title: "Power Bank Quality Control & Product Testing | Shanze", description: "Review Shanze's inspection approach for charging products. Request model-specific test reports and quality documents for your target market." }); }

function selectGalleryImage(source: string | null | undefined, originalSource: (source: string) => string) {
  const value = source?.trim() || "";
  if (!value) return "";
  try {
    const url = new URL(value, "https://shanzesz.com");
    return ["http:", "https:"].includes(url.protocol) && !originalSource(url.pathname).startsWith("/references/") ? value : "";
  } catch { return ""; }
}

export default async function QualityPage() {
  const locale = await getLocale();
  const originalSource = await getOriginalImageSourceLookup();
  const galleryImage = (source?: string | null) => selectGalleryImage(source, originalSource);
  const [rawCertificates, rawWorkshops, rawBanners, section] = await Promise.all([
    db.certificate.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } }),
    db.workshop.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } }),
    db.banner.findMany({ where: { page: "quality", status: "PUBLISHED" }, orderBy: { sortOrder: "asc" } }),
    getPageSectionMap("quality", locale),
  ]);
  const [certificates, workshops, banners] = await Promise.all([
    translateEntities("Certificate", rawCertificates, ["name", "issuer", "certificateNo"], locale),
    translateEntities("Workshop", rawWorkshops, ["name", "description"], locale),
    translateEntities("Banner", rawBanners, ["title", "subtitle", "description", "ctaLabel"], locale),
  ]);
  const zh = locale === "zh";
  const banner = banners[0];
  const control = section.control;
  const lab = section.lab;
  const certifications = section.certifications;
  const workshopSection = section.workshop;
  const traceability = section.traceability;
  const controlIcons = [ShieldCheck, Settings, Search, PackageCheck, CheckCircle2];
  return <>
    <Hero page="quality" image={banner?.image} title={banner?.title || (zh ? "严格质量控制" : "Strict Quality Control,")} accent={banner?.subtitle || (zh ? "可靠性能保障" : "Reliable Performance")} subtitle={banner?.description || (zh ? "根据项目需求评审来料、过程与出货检验，并核对所选型号和目标市场的质量资料。" : "Review incoming, in-process and outgoing inspection information, then confirm quality documents for the selected model and target market.")} ctaLabel={banner?.ctaLabel || (zh ? "索取质量文件" : "Request Quality File")} ctaHref={banner?.ctaHref || "/contact"} slides={banners.map((item) => ({ id: item.id, image: item.image, title: item.title, accent: item.subtitle, subtitle: item.description || "", ctaLabel: item.ctaLabel || (zh ? "索取质量文件" : "Request Quality File"), ctaHref: item.ctaHref || "/contact" }))} />
    {control && <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">{control.subtitle}</div><h2 className="section-title">{control.title}</h2><p>{control.content}</p></div><div className="grid-cards cert-grid">{control.parsedItems.map((item, index) => { const Icon = controlIcons[index % controlIcons.length]; return <article className="card feature-card" key={`${item.value}-${index}`}>{item.image ? <SeoImage className="quality-item-image" src={item.image} alt="" /> : <span className="icon-badge"><Icon size={24} /></span>}<h3 className="!text-brand-600">{item.value}</h3><strong className="text-xs">{item.title}</strong><p>{item.text}</p></article>; })}</div></div></section>}
    {lab && <section className="section section-soft"><div className="container-site"><div className="center-head"><div className="eyebrow">{lab.subtitle}</div><h2 className="section-title">{lab.title}</h2><p>{lab.content}</p></div><AutoScrollCarousel label={zh ? "实验室与可靠性测试轮播" : "Test lab and reliability carousel"} previousLabel={zh ? "查看上一项测试" : "Previous test"} nextLabel={zh ? "查看下一项测试" : "Next test"}>{lab.parsedItems.map((item, index) => {
      const source = galleryImage(item.image);
      return <article className="card gallery-card" key={`${item.title}-${index}`}>
        <div className={`card-art ${styles.galleryMedia}`}>
          {source ? <SeoImage src={source} alt={item.title || (zh ? "可靠性测试设备" : "Reliability test equipment")} fill sizes="(max-width: 640px) 86vw, (max-width: 960px) 50vw, 20vw" /> : <Search size={32} aria-hidden="true" />}
        </div>
        <h3>{item.title}</h3><p>{item.text}</p>
      </article>;
    })}</AutoScrollCarousel></div></section>}
    {certifications && <section className="section" id="quality-documents"><div className="container-site"><div className="center-head"><div className="eyebrow">{certifications.subtitle}</div><h2 className="section-title">{certifications.title}</h2><p>{certifications.content}</p></div><CertificateGallery certificates={certificates.map((certificate) => ({ id: certificate.id, name: certificate.name, category: certificate.category, issuer: certificate.issuer, certificateNo: certificate.certificateNo, image: certificate.image, fileUrl: certificate.fileUrl, expiresAt: certificate.expiresAt?.toISOString() || null }))} locale={locale} now={Date.now()} /></div></section>}
    {workshopSection && <section className="section section-soft"><div className="container-site"><div className="center-head"><div className="eyebrow">{workshopSection.subtitle}</div><h2 className="section-title">{workshopSection.title}</h2><p>{workshopSection.content}</p></div><AutoScrollCarousel label={zh ? "车间环境图片轮播" : "Workshop environment carousel"} previousLabel={zh ? "查看上一张车间图片" : "Previous workshop image"} nextLabel={zh ? "查看下一张车间图片" : "Next workshop image"}>{workshops.map((item) => {
      const source = galleryImage(item.image);
      return <article className="card gallery-card" key={item.id}>
        <div className={`card-art ${styles.galleryMedia}`}>
          {source ? <SeoImage src={source} alt={item.name} fill sizes="(max-width: 640px) 86vw, (max-width: 960px) 50vw, 20vw" /> : <PackageCheck size={32} aria-hidden="true" />}
        </div>
        <h3>{item.name}</h3><p>{item.description}</p>
      </article>;
    })}</AutoScrollCarousel></div></section>}
    {traceability && <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">{traceability.subtitle}</div><h2 className="section-title">{traceability.title}</h2><p>{traceability.content}</p></div><FeatureCards features={traceability.parsedItems.map((item) => ({ title: item.title || "", text: item.text || "" }))} /></div></section>}
  </>;
}
