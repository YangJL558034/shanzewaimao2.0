import Link from "next/link";
import { CheckCircle2, ClipboardCheck, Factory, PackageCheck, PenTool, Search, Settings, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { ProductCards } from "@/components/public/ContentCards";
import { JsonLd } from "@/components/public/JsonLd";
import { absoluteUrl } from "@/lib/utils";
import { seoLandings, type SeoLandingSlug } from "@/lib/seo-landings";

const steps = [
  [Search, "Requirement review", "Confirm the intended product, target market and project scope."],
  [PenTool, "Design coordination", "Align product options, brand presentation and packaging requirements."],
  [Settings, "Sample validation", "Review the confirmed sample before production planning."],
  [Factory, "Manufacturing", "Produce according to the confirmed specification and process controls."],
  [ClipboardCheck, "Quality control", "Inspect and document the agreed quality checkpoints."],
  [PackageCheck, "Delivery preparation", "Complete packaging and shipping documentation for the project."],
] as const;

const faqs = [
  { question: "Can Shanze support OEM and ODM projects?", answer: "Yes. Available customization and development scope are confirmed for each product and project before sampling." },
  { question: "Can we customize the logo and packaging?", answer: "Logo, color and packaging options can be discussed based on the selected product and confirmed project requirements." },
  { question: "How do we obtain specifications and a quotation?", answer: "Send the target product, market and customization requirements through the quotation form. The sales team will confirm available technical information." },
] as const;

export async function SeoLandingPage({ slug }: { slug: SeoLandingSlug }) {
  const page = seoLandings[slug];
  const [categories, products] = await Promise.all([
    db.productCategory.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" }, take: 5 }),
    db.product.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }], take: 5 }),
  ]);
  return <>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") }, { "@type": "ListItem", position: 2, name: page.h1, item: absoluteUrl(`/${slug}`) }] }} />
    <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) }} />
    <section className="seo-landing-hero"><div className="container-site"><div className="eyebrow">Shanze OEM/ODM Charging Solutions</div><h1>{page.h1}</h1><p>{page.intro}</p><div className="flex flex-wrap gap-3"><Link className="btn btn-primary" href="/contact#quote">Get a Quote</Link><Link className="btn btn-outline" href="/products">Explore Products</Link></div></div></section>
    <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">Product Focus</div><h2 className="section-title">Solutions Built Around Confirmed Requirements</h2></div><div className="grid-cards grid-cols-1 md:grid-cols-4">{page.focus.map((item)=><article className="card feature-card" key={item}><CheckCircle2 className="mx-auto text-brand-600"/><h3>{item}</h3><p>Options and technical details are confirmed against the selected model and target market.</p></article>)}</div></div></section>
    <section className="section section-soft"><div className="container-site"><div className="center-head"><div className="eyebrow">Product Categories</div><h2 className="section-title">Explore Published Charging Product Categories</h2></div><div className="seo-category-links">{categories.map((category)=><Link href={`/products?category=${category.slug}`} key={category.id}><strong>{category.name}</strong><span>{category.description}</span></Link>)}</div></div></section>
    <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">OEM/ODM Process</div><h2 className="section-title">From Requirement Review to Delivery Preparation</h2></div><div className="process">{steps.map(([Icon,title,text],index)=><div className="process-step" key={title}><span className="icon-badge"><Icon size={22}/></span><strong>{index+1}. {title}</strong><small>{text}</small></div>)}</div></div></section>
    <section className="section section-soft"><div className="container-site"><div className="center-head"><div className="eyebrow">Recommended Products</div><h2 className="section-title">Published Products for B2B Enquiries</h2></div><ProductCards products={products}/></div></section>
    <section className="section"><div className="container-site spec-grid"><div><div className="eyebrow">Quality Control</div><h2 className="section-title">Controlled Manufacturing Support</h2><p className="section-copy">Project requirements are linked to sampling, production planning and agreed inspection activities. Available test records and compliance documents depend on the selected model and target market.</p><Link className="text-link" href="/quality">Review quality capabilities →</Link></div><div className="faq"><h2 className="section-title">Frequently Asked Questions</h2>{faqs.map((faq)=><details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></div></section>
    <section className="seo-landing-cta"><div className="container-site"><ShieldCheck size={38}/><div><h2>Discuss Your Charging Product Project</h2><p>Share the product type, target market and customization needs for a reviewed quotation.</p></div><Link className="btn bg-white text-brand-600" href="/contact#quote">Get A Quote</Link></div></section>
  </>;
}
