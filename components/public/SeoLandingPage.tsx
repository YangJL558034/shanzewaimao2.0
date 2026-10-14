import Link from "next/link";
import { SeoImage } from "@/components/public/SeoImage";
import { ArrowRight, CheckCircle2, ClipboardCheck, Factory, PackageCheck, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { JsonLd } from "@/components/public/JsonLd";
import { absoluteUrl } from "@/lib/utils";
import { getLocale, translateEntities } from "@/lib/i18n";
import { visualMediaKind } from "@/lib/media-url";
import { seoLandings, seoLandingContent, type SeoLandingSlug } from "@/lib/seo-landings";
import "./seo-landings.css";

const workflow = {
  en: [
    { title: "Define the requirement", text: "Share the use case, sales market, expected quantity and planned launch date." },
    { title: "Review the specification", text: "Confirm the model, customization, test criteria and required documents." },
    { title: "Approve the sample", text: "Review the representative sample and record final artwork and acceptance criteria." },
    { title: "Plan production and inspection", text: "Agree the order specification, inspection checkpoints, packaging and delivery." },
  ],
  zh: [
    { title: "明确需求", text: "提供场景、销售市场、数量和上市计划。" },
    { title: "核对规格", text: "确认型号、定制、测试标准和所需文件。" },
    { title: "确认样品", text: "评估代表性样品，记录最终图稿和验收要求。" },
    { title: "规划生产与检验", text: "约定规格、检验节点、包装和交付。" },
  ],
};

export async function SeoLandingPage({ slug }: { slug: SeoLandingSlug }) {
  const locale = await getLocale();
  const zh = locale === "zh";
  const page = seoLandings[slug];
  const content = seoLandingContent[slug][zh ? "zh" : "en"];
  const h1 = content.h1 || page.h1;
  const [rawCategories, publishedProducts] = await Promise.all([
    db.productCategory.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } }),
    db.product.findMany({
      where: { status: "PUBLISHED", noIndex: false, category: { isVisible: true } },
      orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
      include: { category: true },
    }),
  ]);
  const matchesTopic = (name: string) => {
    const lower = name.toLowerCase();
    const bank = /power\s*bank|powerbank|充电宝|移动电源/.test(lower);
    if (slug === "wireless-charger-manufacturer") return /wireless|无线|充电支架|充电板/.test(lower) && !bank;
    if (slug.startsWith("magnetic-power-bank")) return /magnetic|磁吸/.test(lower) && bank;
    return content.productTerms.some((term) => lower.includes(term));
  };
  // Model names, rather than broad category assignments, determine topical relevance.
  const rawProducts = publishedProducts.filter((product) => matchesTopic(`${product.name} ${product.slug}`)).slice(0, 6);
  const [products, categories] = await Promise.all([
    translateEntities("Product", rawProducts, ["name", "summary"], locale),
    translateEntities("ProductCategory", rawCategories.filter((category) => matchesTopic(`${category.name} ${category.slug}`)), ["name", "description"], locale),
  ]);
  return <article className="seo-buyer-page">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: zh ? "首页" : "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: h1, item: absoluteUrl(`/${slug}`) },
    ] }} />
    <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: content.faqs.map((faq) => ({
      "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })) }} />
    {products.length > 0 && <JsonLd data={{ "@context": "https://schema.org", "@type": "ItemList", name: zh ? "相关已发布产品" : "Relevant published products", itemListElement: products.map((product, index) => ({
      "@type": "ListItem", position: index + 1, name: product.name, url: absoluteUrl(`/products/${product.slug}`),
    })) }} />}

    <section className="seo-landing-hero">
      <div className="container-site">
        <nav className="seo-breadcrumb" aria-label={zh ? "面包屑导航" : "Breadcrumb"}>
          <Link href="/">{zh ? "首页" : "Home"}</Link><span aria-hidden="true">/</span><span aria-current="page">{h1}</span>
        </nav>
        <div className="eyebrow">{zh ? "Shanze · 海外 B2B 充电产品项目" : "Shanze · B2B Charging Product Projects"}</div>
        <h1>{h1}</h1>
        <p>{content.intro || page.intro}</p>
        <div className="flex flex-wrap gap-3">
          <Link className="btn btn-primary" href="/contact#quote">{zh ? "发送项目需求" : "Request a Project Quote"}<ArrowRight size={18} /></Link>
          <Link className="btn btn-outline" href="#published-products">{zh ? "查看相关产品" : "View Relevant Products"}</Link>
        </div>
        <ul className="seo-focus-list">{(content.focus || page.focus).map((item) => <li key={item}><CheckCircle2 size={17} aria-hidden="true" />{item}</li>)}</ul>
      </div>
    </section>

    <nav className="container-site seo-section-nav" aria-label={zh ? "本页内容" : "On this page"}>
      <a href="#buyer-guide">{zh ? "采购指南" : "Buyer Guide"}</a><a href="#rfq-checklist">{zh ? "询价清单" : "RFQ Checklist"}</a><a href="#published-products">{zh ? "产品选型" : "Products"}</a><a href="#project-process">{zh ? "项目流程" : "Project Process"}</a><a href="#project-faq">{zh ? "常见问题" : "FAQs"}</a>
    </nav>

    <section className="section" id="buyer-guide">
      <div className="container-site seo-guide-layout">
        <div className="seo-guide-copy">
          <div className="eyebrow">{zh ? "采购指南" : "Buyer Guide"}</div>
          <h2 className="section-title">{content.overviewTitle}</h2>
          <p className="seo-guide-intro">{content.overview}</p>
          {content.sections.map((section) => <section className="seo-buyer-topic" key={section.title}>
            <h3>{section.title}</h3>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </section>)}
        </div>
        <aside className="seo-rfq-card" id="rfq-checklist">
          <span className="icon-badge"><ClipboardCheck size={24} aria-hidden="true" /></span>
          <h2>{content.checklistTitle}</h2>
          <p>{zh ? "将这些资料随询盘提交，便于明确评估与报价范围。" : "Include these details with your enquiry to make the assessment and quotation scope clear."}</p>
          <ul>{content.checklist.map((item) => <li key={item}><CheckCircle2 size={17} aria-hidden="true" /><span>{item}</span></li>)}</ul>
          <Link className="btn btn-primary" href="/contact#quote">{zh ? "提交询盘" : "Send Your RFQ"}<ArrowRight size={17} /></Link>
          <Link className="seo-small-link" href="/products">{zh ? "查看产品目录" : "Review the product catalogue"}</Link>
        </aside>
      </div>
    </section>

    <section className="section section-soft" id="published-products">
      <div className="container-site">
        <div className="seo-section-head"><div><div className="eyebrow">{zh ? "产品选型" : "Product Selection"}</div><h2 className="section-title">{zh ? "与本项目相关的已发布产品" : "Published Products Relevant to This Project"}</h2></div><Link className="text-link" href="/products">{zh ? "全部产品" : "Full catalogue"} →</Link></div>
        <p className="seo-product-note">{zh ? "以产品详情为选型依据，最终规格、选项和目标市场文件需按型号确认。" : "Use the product details as a sourcing reference. Final specifications, options and destination-market documents are confirmed for the selected model."}</p>
        {products.length > 0 ? <div className="seo-product-grid">{products.map((product) => <article className="card seo-product-card" key={product.id}>
          <Link href={`/products/${product.slug}`} className="seo-product-image" tabIndex={-1} aria-hidden="true">
            {product.coverImage && visualMediaKind(product.coverImage) === "image" ? <SeoImage src={product.coverImage} alt={zh ? `${product.name} — ${product.category.name} 产品图片` : `${product.name} — ${product.category.name} product image`} fill sizes="(max-width: 640px) 100vw, (max-width: 980px) 50vw, 33vw" /> : <PackageCheck size={48} aria-hidden="true" />}
          </Link>
          <div className="card-body"><h3><Link href={`/products/${product.slug}`}>{product.name}</Link></h3><p>{product.summary}</p><Link className="text-link" href={`/products/${product.slug}`}>{zh ? "查看型号与规格" : "Review model and specifications"} →</Link></div>
        </article>)}</div> : <div className="seo-catalog-note"><p>{zh ? "请发送技术需求，以便确认适用型号与项目可行性。" : "Send your technical brief so the team can confirm suitable models and project feasibility."}</p><Link className="text-link" href="/contact#quote">{zh ? "咨询具体型号" : "Ask about a model"} →</Link></div>}
        {categories.length > 0 && <div className="seo-category-pills" aria-label={zh ? "相关产品分类" : "Relevant product categories"}>{categories.map((category) => <Link key={category.id} href={`/products?category=${encodeURIComponent(category.slug)}`}>{category.name}<ArrowRight size={14} /></Link>)}</div>}
      </div>
    </section>

    <section className="section" id="project-process"><div className="container-site">
      <div className="center-head"><div className="eyebrow">{zh ? "项目流程" : "Project Workflow"}</div><h2 className="section-title">{zh ? "从书面需求到确认的生产计划" : "From a Written Brief to an Agreed Production Plan"}</h2></div>
      <ol className="seo-workflow">{workflow[zh ? "zh" : "en"].map((step, index) => <li key={step.title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
      <div className="seo-evidence-links">
        <Link href="/factory"><Factory size={24} aria-hidden="true" /><div><strong>{zh ? "查看制造信息" : "Review manufacturing information"}</strong><span>{zh ? "已发布的工厂、设备与生产内容" : "Published factory, equipment and production content"}</span></div><ArrowRight size={18} /></Link>
        <Link href="/quality"><ShieldCheck size={24} aria-hidden="true" /><div><strong>{zh ? "查看质量信息" : "Review quality information"}</strong><span>{zh ? "检验内容与项目文件需求" : "Inspection content and project documentation needs"}</span></div><ArrowRight size={18} /></Link>
      </div>
    </div></section>

    <section className="section section-soft" id="project-faq"><div className="container-site seo-faq-layout">
      <div><div className="eyebrow">{zh ? "项目问答" : "Project Questions"}</div><h2 className="section-title">{zh ? "常见采购问题" : "Frequently Asked Sourcing Questions"}</h2><p className="section-copy">{zh ? "需要更具体的信息？请附上型号、市场与项目要求联系我们。" : "Need a more specific answer? Contact the team with your model, destination market and project requirements."}</p><Link className="text-link" href="/contact#quote">{zh ? "联系项目团队" : "Contact the project team"} →</Link></div>
      <div className="faq">{content.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div>
    </div></section>

    <section className="section"><div className="container-site"><div className="seo-section-head"><div><div className="eyebrow">{zh ? "继续了解" : "Continue Your Research"}</div><h2 className="section-title">{zh ? "相关采购与定制指南" : "Related Sourcing and Customization Guides"}</h2></div><Link className="text-link" href="/blog">{zh ? "行业博客" : "Industry blog"} →</Link></div><div className="seo-related-guides">{content.related.map((related) => <Link href={`/${related}`} key={related}><strong>{zh ? seoLandingContent[related].zh.h1 || seoLandings[related].h1 : seoLandings[related].h1}</strong><ArrowRight size={18} /></Link>)}</div></div></section>

    <section className="seo-landing-cta"><div className="container-site"><ClipboardCheck size={38} aria-hidden="true" /><div><h2>{zh ? "开始您的充电产品项目" : "Start Your Charging Product Project"}</h2><p>{zh ? "提供型号、市场和定制需求，以便沟通具体方案。" : "Share the model, market and customization brief for a project-specific discussion."}</p></div><Link className="btn bg-white text-brand-600" href="/contact#quote">{zh ? "发送询盘" : "Request a Quote"}</Link></div></section>
  </article>;
}
