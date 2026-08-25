import { LegalDocument } from "@/components/public/LegalDocument";
import { getSeoMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return getSeoMetadata("/privacy-policy", { title: "Privacy Policy", description: "How we collect, use and protect website visitor and business inquiry information." });
}
export default function PrivacyPolicyPage() {
  return <LegalDocument kind="privacy" />;
}
