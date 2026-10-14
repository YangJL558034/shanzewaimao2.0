import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import { Header } from "@/components/public/Header";
import { Footer } from "@/components/public/Footer";
import { absoluteUrl } from "@/lib/utils";
import { getLocale } from "@/lib/i18n";
import { db } from "@/lib/db";
import { CookieConsent } from "@/components/public/CookieConsent";
import { VisitTracker } from "@/components/public/VisitTracker";
import { CustomerChannels } from "@/components/public/CustomerChannels";
import { getCustomerChannelConfig } from "@/lib/customer-channel-settings";
import { headers } from "next/headers";
import { getSeoIntegrationConfig } from "@/lib/seo-settings";
import { GoogleAnalytics } from "@/components/public/GoogleAnalytics";
import { SiteSchema } from "@/components/public/SiteSchema";
import { ImageSeoProvider } from "@/components/public/ImageSeoProvider";
import { getImageSeoMap, resolveSeoImage } from "@/lib/image-seo-data";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await db.setting.findMany({
    where: { key: { in: ["company_name", "site_name", "company_description"] } },
  }).catch(() => []);
  const map = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
  const companyName = map.company_name || map.site_name || "Shanze New Energy Technology Co., Ltd.";
  const description = map.company_description || "OEM/ODM manufacturer of power banks and wireless chargers for global B2B buyers.";
  const defaultSocialSource = await resolveSeoImage("/generated/site/hero-home.webp");
  const defaultSocialImage = absoluteUrl(defaultSocialSource);
  const socialDimensions = (await getImageSeoMap())[defaultSocialSource];
  const { searchConsoleToken: googleVerification } = await getSeoIntegrationConfig();
  return {
    metadataBase: new URL(absoluteUrl("/")),
    title: { default: companyName, template: `%s | ${companyName}` },
    description,
    icons: {
      icon: [{ url: "/shanze-brand-icon.png?v=20260824", type: "image/png" }],
      shortcut: "/shanze-brand-icon.png?v=20260824",
      apple: "/shanze-brand-icon.png?v=20260824",
    },
    keywords: ["OEM charger manufacturer", "magnetic power bank", "wireless charger factory", "ODM charging products"],
    openGraph: { type: "website", siteName: companyName, title: companyName, description, url: absoluteUrl("/"), images: [{ url: defaultSocialImage, ...(socialDimensions ? { width: socialDimensions.width, height: socialDimensions.height } : {}), alt: companyName }] },
    twitter: { card: "summary_large_image", title: companyName, description, images: [defaultSocialImage] },
    robots: { index: true, follow: true },
    ...(googleVerification ? { verification: { google: googleVerification } } : {}),
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#075bd8" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const customerChannels = await getCustomerChannelConfig();
  const { ga4Id } = await getSeoIntegrationConfig();
  const nonce = (await headers()).get("x-nonce") || "";
  const imageSeo = await getImageSeoMap();
  return (
    <html
      lang={locale === "zh" ? "zh-CN" : "en"}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <ImageSeoProvider images={imageSeo}>
        <Header />
        <main>{children}</main>
        <Footer />
        <SiteSchema />
        <GoogleAnalytics measurementId={ga4Id} nonce={nonce} enabled={process.env.NODE_ENV === "production"} />
        <VisitTracker />
        <CustomerChannels config={customerChannels} locale={locale} />
        <CookieConsent locale={locale} />
        </ImageSeoProvider>
      </body>
    </html>
  );
}
