import Link from "next/link";
import { Facebook, Linkedin, Mail, MapPin, Music2, Phone, Youtube } from "lucide-react";
import { db } from "@/lib/db";
import { getLocale, translateEntity } from "@/lib/i18n";
import { DismissibleCta } from "@/components/public/DismissibleCta";
import { NewsletterForm } from "@/components/public/NewsletterForm";

export async function Footer() {
  const [settings, locale, products, footerNavigation] = await Promise.all([
    db.setting.findMany({ where: { isPublic: true } }).catch(() => []),
    getLocale(),
    db.product
      .findMany({
        where: { status: "PUBLISHED" },
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
        take: 6,
      })
      .catch(() => []),
    db.navigationItem.findMany({ where: { location: "FOOTER", isVisible: true }, orderBy: { sortOrder: "asc" } }).catch(() => []),
  ]);
  const map = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
  const [localizedProducts, localizedFooterNavigation] = await Promise.all([
    Promise.all(products.map((product) => translateEntity("Product", product, ["name"], locale))),
    Promise.all(footerNavigation.map((item) => translateEntity("NavigationItem", item, ["label"], locale))),
  ]);
  const zh = locale === "zh";
  const pick = (key: string, fallback: string) =>
    (zh && map[`${key}_zh`] ? map[`${key}_zh`] : map[key]) || fallback;
  const fallbackLinks = zh
    ? [
        ["首页", "/"],
        ["关于我们", "/about"],
        ["产品中心", "/products"],
        ["工厂实力", "/factory"],
        ["品质保障", "/quality"],
        ["新闻资讯", "/news"],
        ["联系我们", "/contact"],
      ]
    : [
        ["Home", "/"],
        ["About Us", "/about"],
        ["Products", "/products"],
        ["Factory", "/factory"],
        ["Quality", "/quality"],
        ["News", "/news"],
        ["Contact", "/contact"],
      ];
  const links = localizedFooterNavigation.length
    ? localizedFooterNavigation.map((item) => [item.label, item.href])
    : fallbackLinks;
  const brandName = pick("site_name", "ENERCORE");
  const logoUrl = map.logo_url || "";
  const socialLinks = [
    { key: "social_facebook", label: "Facebook", icon: Facebook, fallback: "https://www.facebook.com/" },
    { key: "social_linkedin", label: "LinkedIn", icon: Linkedin, fallback: "https://www.linkedin.com/" },
    { key: "social_youtube", label: "YouTube", icon: Youtube, fallback: "https://www.youtube.com/" },
    { key: "social_tiktok", label: "TikTok", icon: Music2, fallback: "https://www.tiktok.com/" },
    { key: "social_email", label: "Email", icon: Mail, fallback: map.email ? `mailto:${map.email}` : "" },
  ].map((item) => ({ ...item, href: map[item.key] || item.fallback || "" })).filter((item) => item.href);
  const ctaTitle = pick("cta_title", zh ? "准备开始您的项目了吗？" : "Ready to Start Your Project?");
  const ctaDescription = pick("cta_description", zh ? "让我们为您的市场打造合适的充电解决方案。" : "Let’s build the right charging solution for your market.");
  const ctaLabel = pick("cta_label", zh ? "立即获取报价" : "Get a Quote Now");
  const legalText = pick("footer_legal", zh ? "隐私政策 | 使用条款 | 网站地图" : "Privacy Policy | Terms of Use | Sitemap");
  const configuredLegalLabels = legalText.split(/[|｜]/).map((label) => label.trim()).filter(Boolean);
  const legalLinks = [
    { label: configuredLegalLabels[0] || (zh ? "隐私政策" : "Privacy Policy"), href: "/privacy-policy" },
    { label: configuredLegalLabels[1] || (zh ? "使用条款" : "Terms of Use"), href: "/terms-of-use" },
    { label: configuredLegalLabels[2] || (zh ? "网站地图" : "Sitemap"), href: "/site-map" },
  ];
  return (
    <>
      <DismissibleCta
        title={ctaTitle}
        description={ctaDescription}
        buttonLabel={ctaLabel}
        buttonHref={map.cta_href || "/contact#quote"}
        closeLabel={zh ? "关闭报价提示" : "Close quote banner"}
      />
      <footer className="site-footer">
        <div className="container-site">
          <div className="footer-grid">
            <div>
              <div className="brand footer-brand">
                {logoUrl ? (
                  <img className="brand-logo-image" src={logoUrl} alt={brandName} />
                ) : (
                  <span className="brand-mark">{brandName.slice(0, 1)}</span>
                )}
                <span>
                  <span className="brand-name">{brandName}</span>
                  <span className="brand-tag">
                    {pick("site_tagline", "POWERING YOUR LIFE")}
                  </span>
                </span>
              </div>
              <p>
                {pick(
                  "company_description",
                  zh
                    ? "专业便携充电产品 OEM/ODM 制造商，为全球客户提供可靠的充电解决方案。"
                    : "Professional OEM/ODM manufacturer of portable charging products, providing reliable solutions to customers worldwide.",
                )}
              </p>
              <div className="socials">
                {socialLinks.map(({ key, label, icon: Icon, href }) => <a key={key} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} aria-label={label}><Icon size={14} /></a>)}
              </div>
            </div>
            <div>
              <h3>{pick("footer_quick_title", zh ? "快速链接" : "Quick Links")}</h3>
              <ul>
                {links.map(([label, href]) => (
                  <li key={href}><Link href={href}>{label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h3>{pick("footer_products_title", zh ? "产品中心" : "Products")}</h3>
              <ul>
                {localizedProducts.map((product) => (
                  <li key={product.id}>
                    <Link href={`/products/${product.slug}`}>{product.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>{pick("footer_contact_title", zh ? "联系我们" : "Contact Us")}</h3>
              <ul>
                <li><Phone size={13} /> {map.phone || "+86 755 8888 9999"}</li>
                <li><Mail size={13} /> {map.email || "sales@enercore.com"}</li>
                <li><MapPin size={13} /> {pick("address", "Building A, No.168 Industrial Road, Shenzhen, Guangdong, China")}</li>
              </ul>
            </div>
            <div>
              <h3>{pick("footer_newsletter_title", zh ? "订阅资讯" : "Newsletter")}</h3>
              <p>{pick("footer_newsletter_description", zh ? "获取最新新闻和产品动态。" : "Get the latest news and product updates.")}</p>
              <NewsletterForm locale={locale} compact />
            </div>
          </div>
          <div className="footer-bottom">
            <span>
              {pick("footer_copyright", `© ${new Date().getFullYear()} ${pick("company_name", "Enercore Technology Co., Ltd.")} ${zh ? "版权所有。" : "All Rights Reserved."}`)}
            </span>
            <nav className="footer-legal-links" aria-label={zh ? "法律与网站信息" : "Legal and site information"}>
              {legalLinks.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
            </nav>
          </div>
        </div>
      </footer>
    </>
  );
}
