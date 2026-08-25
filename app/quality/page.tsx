import type { CSSProperties } from "react";
import { CheckCircle2, PackageCheck, Search, Settings, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { Hero } from "@/components/public/Hero";
import { FeatureCards } from "@/components/public/ContentCards";
import { AutoScrollCarousel } from "@/components/public/AutoScrollCarousel";
import { getSeoMetadata } from "@/lib/seo";
import { getLocale, translateEntities } from "@/lib/i18n";
import { getPageSectionMap } from "@/lib/page-content";

export const dynamic = "force-dynamic";
export async function generateMetadata() { return getSeoMetadata("/quality", { title: "Quality Control", description: "Strict IQC, IPQC, FQC and OQC processes backed by product testing, traceability and global certifications." }); }

export default async function QualityPage() {
  const locale = await getLocale();
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
    <Hero page="quality" image={banner?.image} title={banner?.title || (zh ? "严格质量控制" : "Strict Quality Control,")} accent={banner?.subtitle || (zh ? "可靠性能保障" : "Reliable Performance")} subtitle={banner?.description || (zh ? "从来料到最终交付执行全面质量管理，确保每一款产品符合国际标准。" : "Our comprehensive quality management system covers incoming materials through final delivery, ensuring every product meets international standards.")} ctaLabel={banner?.ctaLabel || (zh ? "索取质量文件" : "Request Quality File")} ctaHref={banner?.ctaHref || "/contact"} slides={banners.map((item) => ({ id: item.id, image: item.image, title: item.title, accent: item.subtitle, subtitle: item.description || "", ctaLabel: item.ctaLabel || (zh ? "索取质量文件" : "Request Quality File"), ctaHref: item.ctaHref || "/contact" }))} />
    {control && <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">{control.subtitle}</div><h2 className="section-title">{control.title}</h2><p>{control.content}</p></div><div className="grid-cards cert-grid">{control.parsedItems.map((item, index) => { const Icon = controlIcons[index % controlIcons.length]; return <article className="card feature-card" key={`${item.value}-${index}`}>{item.image ? <img className="quality-item-image" src={item.image} alt="" /> : <span className="icon-badge"><Icon size={24} /></span>}<h3 className="!text-brand-600">{item.value}</h3><strong className="text-xs">{item.title}</strong><p>{item.text}</p></article>; })}</div></div></section>}
    {lab && <section className="section section-soft"><div className="container-site"><div className="center-head"><div className="eyebrow">{lab.subtitle}</div><h2 className="section-title">{lab.title}</h2><p>{lab.content}</p></div><AutoScrollCarousel label={zh ? "实验室与可靠性测试轮播" : "Test lab and reliability carousel"} previousLabel={zh ? "查看上一项测试" : "Previous test"} nextLabel={zh ? "查看下一项测试" : "Next test"}>{lab.parsedItems.map((item, index) => <article className="card gallery-card" key={`${item.title}-${index}`}><div className="card-art" style={{ "--art-image": `url(${item.image || lab.image || "/references/quality.png"})`, "--art-position": item.image ? "center" : `${index * 20}% -670px` } as CSSProperties} /><h3>{item.title}</h3><p>{item.text}</p></article>)}</AutoScrollCarousel></div></section>}
    {certifications && <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">{certifications.subtitle}</div><h2 className="section-title">{certifications.title}</h2><p>{certifications.content}</p></div><AutoScrollCarousel label={zh ? "认证资质轮播" : "Certification carousel"} previousLabel={zh ? "查看上一项认证" : "Previous certification"} nextLabel={zh ? "查看下一项认证" : "Next certification"}>{certificates.map((certificate) => {
      const rawHref = certificate.fileUrl || certificate.image || "";
      const href = rawHref.startsWith("/") || /^https?:\/\//i.test(rawHref) ? rawHref : "";
      const preview = certificate.image
        ? <span className="cert-document-frame"><img className="cert-image" src={certificate.image} alt={`${certificate.name} ${zh ? "认证证书" : "certificate"}`} loading="lazy" /><span className="cert-view-label">{zh ? "查看完整证书" : "View full certificate"}</span></span>
        : <span className="cert-document-placeholder"><span className="cert-logo">{certificate.name}</span><small>{zh ? "可在后台上传完整证书照片" : "Upload the full certificate in CMS"}</small></span>;
      return <article className={`card cert-card ${certificate.image ? "has-document" : ""}`} key={certificate.id}>{href ? <a className="cert-document-link" href={href} target="_blank" rel="noreferrer" aria-label={`${zh ? "查看" : "View"} ${certificate.name}`}>{preview}</a> : preview}<div className="cert-card-details"><strong>{certificate.issuer || certificate.name}</strong><p>{certificate.certificateNo || (zh ? "已验证产品合规" : "Verified product compliance")}</p></div></article>;
    })}</AutoScrollCarousel></div></section>}
    {workshopSection && <section className="section section-soft"><div className="container-site"><div className="center-head"><div className="eyebrow">{workshopSection.subtitle}</div><h2 className="section-title">{workshopSection.title}</h2><p>{workshopSection.content}</p></div><AutoScrollCarousel label={zh ? "车间环境图片轮播" : "Workshop environment carousel"} previousLabel={zh ? "查看上一张车间图片" : "Previous workshop image"} nextLabel={zh ? "查看下一张车间图片" : "Next workshop image"}>{workshops.map((item, index) => <article className="card gallery-card" key={item.id}><div className="card-art" style={{ "--art-image": `url(${item.image || workshopSection.image || "/references/quality.png"})`, "--art-position": item.image ? "center" : `${index * 25}% -1020px` } as CSSProperties} /><h3>{item.name}</h3><p>{item.description}</p></article>)}</AutoScrollCarousel></div></section>}
    {traceability && <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">{traceability.subtitle}</div><h2 className="section-title">{traceability.title}</h2><p>{traceability.content}</p></div><FeatureCards features={traceability.parsedItems.map((item) => ({ title: item.title || "", text: item.text || "" }))} /></div></section>}
  </>;
}
