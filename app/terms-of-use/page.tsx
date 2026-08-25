import { LegalDocument } from "@/components/public/LegalDocument";
import { getSeoMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return getSeoMetadata("/terms-of-use", { title: "Terms of Use", description: "Terms governing access to and use of this B2B manufacturing website." });
}
export default function TermsOfUsePage() {
  return <LegalDocument kind="terms" />;
}
