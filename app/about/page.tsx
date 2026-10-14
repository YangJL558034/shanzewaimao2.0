import Link from "next/link";
import { SeoImage } from "@/components/public/SeoImage";
import { resolveSeoImage, getOriginalImageSourceLookup } from "@/lib/image-seo-data";
import { Award, Cpu, Factory, FlaskConical } from "lucide-react";
import { db } from "@/lib/db";
import { Hero } from "@/components/public/Hero";
import { StatGrid } from "@/components/public/StatGrid";
import { PartnersMarquee } from "@/components/public/PartnersMarquee";
import { getSeoMetadata } from "@/lib/seo";
import { getLocale, translateEntities } from "@/lib/i18n";
import { getPageSectionMap } from "@/lib/page-content";
import { CompanyTimeline } from "@/components/public/CompanyTimeline";
import "@/components/public/company-profile.css";

export const dynamic = "force-dynamic";
export async function generateMetadata() { return getSeoMetadata("/about", { title: "About Shanze | Power Bank OEM/ODM Manufacturer", description: "Learn about Shanze New Energy Technology Co., Ltd. and our OEM/ODM charging product development and manufacturing support." }); }

export default async function AboutPage() {
  const locale = await getLocale();
  const originalSource = await getOriginalImageSourceLookup();
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
  const storyFallbackImage = await resolveSeoImage(story?.image || "/references/about.png");
  const purposeIcons = [FlaskConical, Cpu, Factory];
  return <>
    <Hero page="about" image={banner?.image} title={banner?.title || (zh ? "关于山泽新能源科技" : "About Shanze New Energy Technology")} accent={banner?.subtitle || (zh ? "值得信赖的 OEM/ODM 合作伙伴" : "Your Trusted Partner in OEM/ODM")} subtitle={banner?.description || (zh ? "为您的品牌提供创新、可靠、高品质的充电解决方案。" : "We deliver innovative, reliable and high-quality charging solutions tailored to power your brand and grow your business.")} ctaLabel={banner?.ctaLabel || (zh ? "联系我们" : "Contact Us")} ctaHref={banner?.ctaHref || "/contact"} slides={banners.map((item) => ({ id: item.id, image: item.image, title: item.title, accent: item.subtitle, subtitle: item.description || "", ctaLabel: item.ctaLabel || (zh ? "联系我们"       : "Contact Us"), ctaHref: item.ctaHref || "/contact" }))} />
    {story && <section className="section company-history" id="company-history"><div className="container-site"><div className="split company-history-summary"><div><div className="eyebrow">{story.subtitle}</div><h2 className="section-title">{story.title}</h2><p className="section-copy whitespace-pre-line">{story.content}</p>{story.buttonLabel && <Link href={story.buttonHref || "/factory"} className="btn btn-outline btn-sm">{story.buttonLabel} →</Link>}</div>{story.image && !originalSource(story.image).startsWith("/references/") ? <figure className="company-history-image"><SeoImage sizes="(max-width: 760px) 100vw, 50vw" src={story.image} alt={zh ? "公司介绍中的厂区照片" : "Factory site photograph from the company profile"} width={originalSource(story.image).includes("manufacturing-facility") ? 800 : 960} height={originalSource(story.image).includes("manufacturing-facility") ? 344 : 640} loading="lazy" /><figcaption>{zh ? "厂区与制造基础" : "Factory site and manufacturing foundation"}</figcaption></figure> : <div className="image-window" style={{ "--crop-image": `url(${storyFallbackImage})`, "--crop-position": story.image ? "center" : "right -340px" } as React.CSSProperties} />}</div><CompanyTimeline items={story.parsedItems} label={zh ? "公司发展历程" : "Company development timeline"} /></div></section>}
    {stats && <section className="section-soft py-12"><div className="container-site"><StatGrid items={stats.parsedItems.map((item) => [item.value || "", item.title || ""])} /></div></section>}
    {purpose && <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">{purpose.subtitle}</div><h2 className="section-title">{purpose.title}</h2><p>{purpose.content}</p></div><div className="grid-cards grid-cols-1 md:grid-cols-3">{purpose.parsedItems.map((item, index) => { const Icon = purposeIcons[index % purposeIcons.length]; return <article className="feature-card" key={`${item.title}-${index}`}><Icon className="mx-auto mb-4 text-brand-600" size={40} />{item.image && <SeoImage sizes="(max-width: 760px) 100vw, 33vw" className="section-item-image" src={item.image} alt={item.title || (zh ? "公司能力图片" : "Company capability illustration")} loading="lazy" />}<h3>{item.title}</h3><p>{item.text}</p>{item.label && <Link className="text-link" href={item.href || "/contact"}>{item.label} →</Link>}</article>; })}</div></div></section>}
    {partners && <section className="section section-soft partners-section"><div className="container-site"><div className="center-head"><div className="eyebrow">{partners.subtitle}</div><h2 className="section-title">{partners.title}</h2><p>{partners.content}</p></div>{partners.parsedItems.length > 0 ? <PartnersMarquee items={partners.parsedItems} label={zh ? "合作伙伴公司自动展示" : "Partner companies showcase"} fallbackImage={partners.image} fallbackImageTitle={partners.sourceSubtitle || partners.subtitle} /> : partners.image && !originalSource(partners.image).startsWith("/references/") ? <figure className="company-profile-market-references"><SeoImage sizes="(max-width: 1180px) 100vw, 1180px" src={partners.image} alt={zh ? "山泽公司资料中的全球市场与客户标识分布图" : "Global market and customer brand distribution map from the Shanze company profile"} width="1532" height="900" loading="lazy" /></figure> : null}</div></section>}
    {global && <section className="section section-soft"><div className="container-site split"><div><div className="eyebrow">{global.subtitle}</div><h2 className="section-title">{global.title}</h2><p className="section-copy whitespace-pre-line">{global.content}</p>{global.buttonLabel && <Link className="btn btn-primary mt-5" href={global.buttonHref || "/contact"}>{global.buttonLabel} →</Link>}</div><div className="rounded-lg bg-blue-50 p-12 text-center">{global.image ? <SeoImage sizes="(max-width: 760px) 100vw, 50vw" className={`section-feature-image${originalSource(global.image).includes("research-laboratory") ? " company-profile-laboratory-image" : ""}`} src={global.image} width={originalSource(global.image).includes("research-laboratory") ? 745 : undefined} height={originalSource(global.image).includes("research-laboratory") ? 667 : undefined} alt={originalSource(global.image).includes("research-laboratory") ? (zh ? "公司资料中的研发与测试实验室照片" : "Research and testing laboratory photograph from the company profile") : global.title || (zh ? "公司业务图片" : "Company business illustration")} loading="lazy" /> : <Award className="mx-auto text-brand-600" size={70} />}{global.parsedItems.map((item, index) => <div key={`${item.title}-${index}`}><h3 className="text-2xl">{item.title}</h3><p className="muted">{item.text}</p></div>)}</div></div></section>}
  </>;
}
