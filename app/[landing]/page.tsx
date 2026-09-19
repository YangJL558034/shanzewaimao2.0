import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeoLandingPage } from "@/components/public/SeoLandingPage";
import { getSeoMetadata } from "@/lib/seo";
import { isSeoLandingSlug, seoLandings } from "@/lib/seo-landings";

export function generateStaticParams() { return Object.keys(seoLandings).map((landing) => ({ landing })); }

export async function generateMetadata({ params }: { params: Promise<{ landing: string }> }): Promise<Metadata> {
  const { landing } = await params;
  if (!isSeoLandingSlug(landing)) return { robots: { index: false, follow: false } };
  const page = seoLandings[landing];
  return getSeoMetadata(`/${landing}`, { title: page.title, description: page.description });
}

export default async function LandingRoute({ params }: { params: Promise<{ landing: string }> }) {
  const { landing } = await params;
  if (!isSeoLandingSlug(landing)) notFound();
  return <SeoLandingPage slug={landing} />;
}
