import Link from "next/link";
import { Award, Eye, Gem, Target } from "lucide-react";
import { db } from "@/lib/db";
import { Hero } from "@/components/public/Hero";
import { StatGrid } from "@/components/public/StatGrid";
import { PartnersMarquee } from "@/components/public/PartnersMarquee";
import { getSeoMetadata } from "@/lib/seo";
import { getLocale, translateEntities } from "@/lib/i18n";
import { getPageSectionMap } from "@/lib/page-content";

export const dynamic = "force-dynamic";
export async function generateMetadata() { return getSeoMetadata("/about", { title: "About Us", description: "Meet ENERCORE, an experienced OEM/ODM charging products manufacturing partner serving global brands." }); }

export default async function AboutPage() {
  const locale = await getLocale();
  const [rawBanners, section] = await Promise.all([
    db.banner.findMany({ where: { page: "about", status: "PUBLISHED" }, orderBy: { sortOrder: "asc" } }),
    getPageSectionMap("about", locale),
  ]);
  const banners = await translateEntities("Banner", rawBanners, ["title", "subtitle", "description", "ctaLabel"], locale);
  const zh = locale === "zh";
  const banner = banners[0];
  const story = section.story;
  const stats = section.stats;
  const purpose = section.purpose;
  const partners = section.partners;
  const global = section.global;
  const purposeIcons = [Target, Eye, Gem];
  return <>
    <Hero page="about" image={banner?.image} title={banner?.title || (zh ? "关于能核科技" : "About Enercore")} accent={banner?.subtitle || (zh ? "值得信赖的 OEM/ODM 合作伙伴" : "Your Trusted Partner in OEM/ODM")} subtitle={banner?.description || (zh ? "为您的品牌提供创新、可靠、高品质的充电解决方案。" : "We deliver innovative, reliable and high-quality charging solutions tailored to power your brand and grow your business.")} ctaLabel={banner?.ctaLabel || (zh ? "联系我们" : "Contact Us")} ctaHref={banner?.ctaHref || "/contact"} slides={banners.map((item) => ({ id: item.id, image: item.image, title: item.title, accent: item.subtitle, subtitle: item.description || "", ctaLabel: item.ctaLabel || (zh ? "联系我们"       : "Contact Us"), ctaHref: item.ctaHref || "/contact" }))} />
    {story && <section className="section"><div className="container-site split"><div><div className="eyebrow">{story.subtitle}</div><h2 className="section-title">{story.title}</h2><p className="section-copy whitespace-pre-line">{story.content}</p><ul className="check-list">{story.parsedItems.map((item, index) => <li key={`${item.value}-${index}`}><strong>{item.value}</strong>{item.value ? " — " : ""}{item.title}</li>)}</ul>{story.buttonLabel && <Link href={story.buttonHref || "/factory"} className="btn btn-outline btn-sm">{story.buttonLabel} →</Link>}</div><div className="image-window" style={{ "--crop-image": `url(${story.image || "/references/about.png"})`, "--crop-position": story.image ? "center" : "right -340px" } as React.CSSProperties} /></div></section>}
    {stats && <section className="section-soft py-12"><div className="container-site"><StatGrid items={stats.parsedItems.map((item) => [item.value || "", item.title || ""])} /></div></section>}
    {purpose && <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">{purpose.subtitle}</div><h2 className="section-title">{purpose.title}</h2><p>{purpose.content}</p></div><div className="grid-cards grid-cols-1 md:grid-cols-3">{purpose.parsedItems.map((item, index) => { const Icon = purposeIcons[index % purposeIcons.length]; return <article className="feature-card" key={`${item.title}-${index}`}><Icon className="mx-auto mb-4 text-brand-600" size={40} />{item.image && <img className="section-item-image" src={item.image} alt="" />}<h3>{item.title}</h3><p>{item.text}</p>{item.label && <Link className="text-link" href={item.href || "/contact"}>{item.label} →</Link>}</article>; })}</div></div></section>}
    {partners && <section className="section section-soft partners-section"><div className="container-site"><div className="center-head"><div className="eyebrow">{partners.subtitle}</div><h2 className="section-title">{partners.title}</h2><p>{partners.content}</p></div><PartnersMarquee items={partners.parsedItems} label={zh ? "合作伙伴公司自动展示" : "Partner companies showcase"} fallbackImage={partners.image} fallbackImageTitle={partners.sourceSubtitle || partners.subtitle} /></div></section>}
    {global && <section className="section section-soft"><div className="container-site split"><div><div className="eyebrow">{global.subtitle}</div><h2 className="section-title">{global.title}</h2><p className="section-copy whitespace-pre-line">{global.content}</p>{global.buttonLabel && <Link className="btn btn-primary mt-5" href={global.buttonHref || "/contact"}>{global.buttonLabel} →</Link>}</div><div className="rounded-lg bg-blue-50 p-12 text-center">{global.image ? <img className="section-feature-image" src={global.image} alt="" /> : <Award className="mx-auto text-brand-600" size={70} />}{global.parsedItems.map((item, index) => <div key={`${item.title}-${index}`}><h3 className="text-2xl">{item.title}</h3><p className="muted">{item.text}</p></div>)}</div></div></section>}
  </>;
}
