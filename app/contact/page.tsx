import { Clock, ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { Hero } from "@/components/public/Hero";
import { InquiryForm } from "@/components/public/InquiryForm";
import { getSeoMetadata } from "@/lib/seo";
import { getLocale, translateEntities } from "@/lib/i18n";
import { getPageSectionMap } from "@/lib/page-content";

export const dynamic = "force-dynamic";
export async function generateMetadata() { return getSeoMetadata("/contact", { title: "Contact & Get a Quote", description: "Send your OEM/ODM charging product requirements to ENERCORE. Our global sales team replies within one business day." }); }

function safeGoogleUrl(value: string | undefined, embed = false) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isGoogle = hostname === "google.com" || hostname.endsWith(".google.com") || hostname === "maps.app.goo.gl" || /^([a-z0-9-]+\.)?google\.[a-z.]+$/.test(hostname);
    if (url.protocol !== "https:" || !isGoogle) return "";
    if (embed && !url.pathname.includes("/maps/embed") && url.searchParams.get("output") !== "embed") return "";
    return url.toString();
  } catch {
    return "";
  }
}

export default async function ContactPage() {
  const locale = await getLocale();
  const [rawCategories, settings, rawBanners, section] = await Promise.all([
    db.productCategory.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } }),
    db.setting.findMany({ where: { isPublic: true } }),
    db.banner.findMany({ where: { page: "contact", status: "PUBLISHED" }, orderBy: { sortOrder: "asc" } }),
    getPageSectionMap("contact", locale),
  ]);
  const [categories, banners] = await Promise.all([
    translateEntities("ProductCategory", rawCategories, ["name"], locale),
    translateEntities("Banner", rawBanners, ["title", "subtitle", "description", "ctaLabel"], locale),
  ]);
  const map = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
  const zh = locale === "zh";
  const banner = banners[0];
  const formSection = section.form;
  const information = section.information;
  const defaultInfo = zh ? [
    { title: "电话 / WhatsApp", value: map.phone || "+86 755 8888 9999", text: "周一至周六，8:30–18:00", image: "" },
    { title: "电子邮箱", value: map.email || "sales@enercore.com", text: "24 小时内回复", image: "" },
    { title: "办公地址", value: map.company_name_zh || map.company_name || "能核科技有限公司", text: map.address_zh || map.address || "中国广东省深圳市工业路168号A栋", image: "" },
    { title: "工作时间", value: "", text: "周一至周五：8:30–18:00\n周六：8:30–12:00\n周日及法定节假日：休息", image: "" },
  ] : [
    { title: "Phone / WhatsApp", value: map.phone || "+86 755 8888 9999", text: "Mon–Sat, 8:30 AM–6:00 PM", image: "" },
    { title: "Email Us", value: map.email || "sales@enercore.com", text: "We reply within 24 hours", image: "" },
    { title: "Office Address", value: map.company_name || "Enercore Technology Co., Ltd.", text: map.address || "Building A, No.168 Industrial Road, Shenzhen, Guangdong, China", image: "" },
    { title: "Business Hours", value: "", text: "Monday–Friday: 8:30 AM–6:00 PM\nSaturday: 8:30 AM–12:00 PM\nSunday & Public Holiday: Closed", image: "" },
  ];
  const infoItems = information?.parsedItems.length ? information.parsedItems : defaultInfo;
  const icons = [Phone, Mail, MapPin, Clock];
  const address = (zh ? map.address_zh : map.address) || map.address || "Building A, No.168 Industrial Road, Shenzhen, Guangdong, China";
  const configuredEmbedUrl = safeGoogleUrl(map.google_maps_embed_url, true);
  const configuredDirectionsUrl = safeGoogleUrl(map.google_maps_directions_url);
  const mapEmbedUrl = configuredEmbedUrl || `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  const directionsUrl = configuredDirectionsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return <>
    <Hero page="contact" image={banner?.image} title={banner?.title || (zh ? "联系我们" : "Contact Us")} accent={banner?.subtitle || (zh ? "我们竭诚助力您的业务" : "We're Here to Power Your Business")} subtitle={banner?.description || (zh ? "如需充电产品或定制方案，请提交需求，我们将在一个工作日内回复。" : "Have questions about our charging products or need a tailored solution? Fill out the form and our team will get back to you within 24 hours.")} ctaLabel={banner?.ctaLabel || (zh ? "提交询盘" : "Send Inquiry")} ctaHref={banner?.ctaHref || "#quote"} slides={banners.map((item) => ({ id: item.id, image: item.image, title: item.title, accent: item.subtitle, subtitle: item.description || "", ctaLabel: item.ctaLabel || (zh ? "提交询盘" : "Send Inquiry"), ctaHref: item.ctaHref || "#quote" }))} />
    <section className="section"><div className="container-site contact-grid" id="quote">
      <InquiryForm locale={locale} categories={categories.map((category) => ({ id: category.id, name: category.name }))} heading={formSection?.title ?? undefined} intro={formSection?.content ?? undefined} submitLabel={formSection?.buttonLabel ?? undefined} />
      <aside className="contact-info">{infoItems.map((item, index) => { const Icon = icons[index % icons.length]; return <article className="card info-card" key={`${item.title}-${index}`}>{item.image ? <img className="contact-item-image" src={item.image} alt="" /> : <span className="icon-badge"><Icon /></span>}<div><h3>{item.title}</h3>{item.value && <strong>{item.value}</strong>}<p className="muted whitespace-pre-line">{item.text}</p></div></article>; })}</aside>
      <div className="card contact-map">
        <iframe
          src={mapEmbedUrl}
          title={zh ? `公司位置：${address}` : `Company location: ${address}`}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
        <a className="map-directions-link" href={directionsUrl} target="_blank" rel="noreferrer">
          <MapPin size={16} />{zh ? "在 Google 地图中查看" : "View on Google Maps"}<ExternalLink size={14} />
        </a>
      </div>
    </div></section>
  </>;
}
