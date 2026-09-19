import type { Metadata } from "next";

export const metadata: Metadata = { title: "Shanze CMS", robots: { index: false, follow: false }, alternates: {} };
export default function AdminLayout({ children }: { children: React.ReactNode }) { return children; }
