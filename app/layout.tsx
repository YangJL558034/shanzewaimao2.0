import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import { Header } from "@/components/public/Header";
import { Footer } from "@/components/public/Footer";
import { absoluteUrl } from "@/lib/utils";
import { getLocale } from "@/lib/i18n";
import { db } from "@/lib/db";
import { CookieConsent } from "@/components/public/CookieConsent";
import { VisitTracker } from "@/components/public/VisitTracker";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await db.setting.findMany({
    where: { key: { in: ["company_name", "site_name", "company_description"] } },
  }).catch(() => []);
  const map = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
  const companyName = map.company_name || "Shanze New Energy Technology Co., Ltd.";
  const description = map.company_description || "Certified OEM/ODM manufacturer of charging products for global B2B buyers.";
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
    title: { default: companyName, template: `%s | ${companyName}` },
    description,
    icons: {
      icon: [{ url: "/shanze-brand-icon.png?v=20260824", type: "image/png" }],
      shortcut: "/shanze-brand-icon.png?v=20260824",
      apple: "/shanze-brand-icon.png?v=20260824",
    },
    keywords: ["OEM charger manufacturer", "magnetic power bank", "wireless charger factory", "ODM charging products"],
    alternates: { canonical: absoluteUrl("/") },
    openGraph: { type: "website", siteName: companyName, title: companyName, description },
    twitter: { card: "summary_large_image", title: companyName, description },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#075bd8" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale === "zh" ? "zh-CN" : "en"}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <Header />
        <main>{children}</main>
        <Footer />
        <VisitTracker />
        <CookieConsent />
      </body>
    </html>
  );
}
