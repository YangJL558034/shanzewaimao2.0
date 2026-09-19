import Link from "next/link";
import { SearchX } from "lucide-react";
import { absoluteUrl } from "@/lib/utils";

export const metadata = { title: "Page Not Found | Shanze", robots: { index: false, follow: true }, alternates: { canonical: absoluteUrl("/404") } };

export default function NotFound() {
  return <section className="not-found-page"><div className="not-found-card"><SearchX size={58}/><p className="eyebrow">404 — Page Not Found</p><h1>The page you requested is unavailable.</h1><p>It may have moved, been removed, or the address may be incorrect.</p><div className="flex flex-wrap justify-center gap-3"><Link className="btn btn-primary" href="/">Back Home</Link><Link className="btn btn-outline" href="/products">Products</Link><Link className="btn btn-outline" href="/contact">Contact Us</Link></div></div></section>;
}
