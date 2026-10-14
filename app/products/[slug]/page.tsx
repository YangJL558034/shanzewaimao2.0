import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { FeatureCards, ProductCards } from "@/components/public/ContentCards";
import { JsonLd } from "@/components/public/JsonLd";
import { absoluteUrl } from "@/lib/utils";
import { safeCanonicalUrl } from "@/lib/seo";
import { getLocale, translateEntities, translateEntity } from "@/lib/i18n";
import { ProductGallery } from "@/components/public/ProductGallery";
import { visualMediaKind } from "@/lib/media-url";
import { productImageSource } from "@/lib/product-image";
import { resolveSeoImage } from "@/lib/image-seo-data";
import { PackageCheck } from "lucide-react";
import { productContentCards, productFaqs, productMetadataFallback, productSourcingGuide, productSpecifications } from "@/lib/product-seo";
import "../product-seo.css";

const getPublishedProduct = cache((slug: string) => db.product.findFirst({
  where: { slug, status: "PUBLISHED" },
  include: { category: true, downloads: true, images: { orderBy: { sortOrder: "asc" } } },
}));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const rawProduct = await getPublishedProduct(slug);
  const canonical = safeCanonicalUrl(`/products/${slug}`, rawProduct?.canonical);
  if (!rawProduct) return { title: { absolute: "Product not found | Shanze" }, robots: { index: false, follow: false }, alternates: { canonical } };
  const locale = await getLocale();
  const product = await translateEntity("Product", rawProduct, ["name", "summary"], locale);
  const fallback = productMetadataFallback(product.name, locale === "zh");
  const title = product.seoTitle || fallback.title;
  const description = product.metaDescription || fallback.description;
  const socialImageSource = productImageSource(product.ogImage) || (visualMediaKind(product.coverImage) === "image" ? productImageSource(product.coverImage) : "");
  const socialImages = socialImageSource ? [{ url: absoluteUrl(await resolveSeoImage(socialImageSource)), alt: product.name }] : [];
  return {
    title: { absolute: title }, description, alternates: { canonical },
    robots: product.noIndex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { type: "website", title: product.ogTitle || title, description: product.ogDescription || description, url: canonical, images: socialImages },
    twitter: { card: socialImages.length ? "summary_large_image" : "summary", title: product.ogTitle || title, description: product.ogDescription || description, images: socialImages.map((image) => image.url) },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rawProduct = await getPublishedProduct(slug);
  if (!rawProduct) notFound();
  const locale = await getLocale();
  const [product, category, relatedRaw] = await Promise.all([
    translateEntity("Product", rawProduct, ["name", "tagline", "summary", "description", "specifications", "features", "applications", "faqs"], locale),
    translateEntity("ProductCategory", rawProduct.category, ["name"], locale),
    db.product.findMany({ where: { categoryId: rawProduct.categoryId, status: "PUBLISHED", id: { not: rawProduct.id } }, orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }], take: 3 }),
  ]);
  const relatedProducts = await translateEntities("Product", relatedRaw, ["name", "features"], locale);
  const zh = locale === "zh";
  const galleryImages = [
    ...(product.coverImage ? [{ url: product.coverImage, alt: `${product.name} ${zh ? "产品主图" : "product view"}` }] : []),
    ...(product.hoverImage && product.hoverImage !== product.coverImage ? [{ url: product.hoverImage, alt: `${product.name} ${zh ? "产品细节图" : "additional product view"}` }] : []),
    ...product.images.map((image, index) => ({ url: image.url, alt: image.alt?.trim() || `${product.name} ${zh ? "产品图库" : "product gallery view"} ${index + 1}` })),
  ].filter((image) => visualMediaKind(image.url) !== "image" || productImageSource(image.url));
  const specs = productSpecifications(product.specifications);
  const features = productContentCards(product.features);
  const applications = productContentCards(product.applications);
  const faqs = productFaqs(product.faqs, zh);
  const sourcing = productSourcingGuide(product, zh);
  const productUrl = safeCanonicalUrl(`/products/${product.slug}`, product.canonical);
  const quoteHref = `/contact?product=${encodeURIComponent(product.slug)}#quote`;
  const categoryHref = `/products?category=${encodeURIComponent(category.slug)}`;
  const schemaImages = await Promise.all(galleryImages.filter((item) => visualMediaKind(item.url) === "image").map(async (item) => absoluteUrl(await resolveSeoImage(item.url))));

  return <>
    <JsonLd data={{
      "@context": "https://schema.org", "@type": "Product", "@id": `${productUrl}#product`,
      name: product.name, sku: product.sku, description: product.summary,
      image: schemaImages,
      brand: { "@type": "Brand", name: "Shanze" },
      manufacturer: { "@type": "Organization", "@id": `${absoluteUrl("/")}#organization`, name: "Shanze New Energy Technology Co., Ltd.", url: absoluteUrl("/") },
      category: category.name, url: productUrl,
      additionalProperty: Object.entries(specs).map(([name, value]) => ({ "@type": "PropertyValue", name, value })),
    }} />
    <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: zh ? "首页" : "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: zh ? "产品中心" : "Products", item: absoluteUrl("/products") },
      { "@type": "ListItem", position: 3, name: product.name, item: productUrl },
    ] }} />
    <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) }} />

    <div className="container-site">
      <nav aria-label={zh ? "面包屑导航" : "Breadcrumb"} className="py-4 text-xs text-slate-500"><Link href="/">{zh ? "首页" : "Home"}</Link>　›　<Link href="/products">{zh ? "产品中心" : "Products"}</Link>　›　<Link href={categoryHref}>{category.name}</Link>　›　<span aria-current="page">{product.name}</span></nav>
      <section className="product-detail-top">
        {galleryImages.length ? <ProductGallery images={galleryImages} productName={product.name} /> : <div className="product-gallery-main product-media-placeholder" aria-hidden="true"><PackageCheck size={64} strokeWidth={1.2}/></div>}
        <div>
          <div className="eyebrow"><Link href={categoryHref}>{category.name}</Link> · {product.sku}</div>
          <h1 className="detail-title">{product.name}</h1>
          {product.tagline && <p className="text-lg font-semibold">{product.tagline}</p>}
          <p className="section-copy product-summary">{product.summary}</p>
          {product.description && product.description !== product.summary && <p className="product-description">{product.description}</p>}
          <div className="flex flex-wrap gap-4"><Link className="btn btn-primary" href={quoteHref}>{zh ? "获取此型号报价" : "Request This Model's Quote"}</Link><Link className="btn btn-outline" href="/contact">{zh ? "联系销售" : "Contact Sales"}</Link></div>
        </div>
      </section>
      <nav className="product-section-links" aria-label={zh ? "产品内容导航" : "Product information"}>
        {features.length > 0 && <a href="#product-features">{zh ? "核心卖点" : "Features"}</a>}
        <a href="#product-specifications">{zh ? "技术规格" : "Specifications"}</a><a href="#product-sourcing">{zh ? "OEM 采购评审" : "OEM Sourcing"}</a><a href="#product-downloads">{zh ? "下载资料" : "Downloads"}</a><a href="#product-faq">{zh ? "采购常见问题" : "Purchasing FAQ"}</a>
      </nav>
    </div>

    {features.length > 0 && <section className="section section-soft" id="product-features"><div className="container-site"><div className="center-head"><h2 className="section-title">{zh ? "核心卖点" : "Key Features"}</h2></div><FeatureCards features={features} /></div></section>}
    <section className="section" id="product-specifications"><div className="container-site spec-grid">
      <div><h2 className="section-title mb-5">{zh ? "技术规格" : "Technical Specifications"}</h2>{Object.keys(specs).length ? <table className="spec-table"><caption className="sr-only">{product.name} {zh ? "产品规格" : "product specifications"}</caption><tbody>{Object.entries(specs).map(([key, value]) => <tr key={key}><th scope="row">{key}</th><td>{value}</td></tr>)}</tbody></table> : <p className="muted">{zh ? "请联系销售团队确认此型号的完整规格。" : "Contact the sales team to confirm the full specification for this model."}</p>}</div>
      <div><h2 className="section-title mb-5">{zh ? "OEM 配置与包装评审" : "OEM Configuration & Packaging Review"}</h2><div className="card p-6"><h3>{zh ? "确认适合您品牌的配置" : "Confirm the Configuration for Your Brand"}</h3><p className="muted">{zh ? "所选型号可支持的产品、品牌、文件和包装选项将在打样前逐项确认。" : "Available product, branding, documentation and packaging options are confirmed for the selected model before sampling."}</p><ul className="check-list"><li>{zh ? "品牌展示方案确认" : "Brand presentation review"}</li><li>{zh ? "产品与包装画面确认" : "Product and packaging artwork review"}</li><li>{zh ? "目标市场文件确认" : "Target-market documentation review"}</li><li>{zh ? "可选配置确认" : "Available configuration confirmation"}</li></ul></div></div>
    </div></section>

    <section className="section section-soft" id="product-sourcing"><div className="container-site">
      <div className="center-head"><div className="eyebrow">{zh ? "制造商采购评审" : sourcing.keyword}</div><h2 className="section-title">{zh ? `${product.name} 项目采购指南` : `Planning Your ${product.name} Project`}</h2></div>
      <p className="product-sourcing-intro">{zh ? "从此型号的规格出发，评审设备适配、品牌方案与采购条件。提供以下信息可以帮助销售团队缩小选型范围并准备可比较的报价。" : "Start with this model's specification, then review device fit, your brand brief and purchasing requirements. The following information helps our sales team narrow the configuration and prepare a comparable quotation."}</p>
      <div className="product-sourcing-cards">{sourcing.checks.map((check) => <article className="card" key={check.title}><h3>{check.title}</h3><p>{check.text}</p></article>)}</div>
      <div className="product-sourcing-links"><Link href={sourcing.landing}>{sourcing.landingLabel} →</Link><Link href={sourcing.guide}>{sourcing.guideLabel} →</Link><Link href="/factory">{zh ? "了解工厂与生产评审" : "Factory & Production Review"} →</Link><Link href="/quality">{zh ? "质量与目标市场文件" : "Quality & Market Documentation"} →</Link></div>
    </div></section>

    {applications.length > 0 && <section className="section"><div className="container-site"><div className="center-head"><h2 className="section-title">{zh ? "产品应用场景" : "Product Applications"}</h2></div><div className="grid-cards grid-cols-1 md:grid-cols-4">{applications.map((application) => <article className="card p-5" key={application.title}><h3>{application.title}</h3><p className="muted">{application.text}</p></article>)}</div></div></section>}
    <section className="section" id="product-downloads"><div className="container-site spec-grid">
      <div><h2 className="section-title mb-5">{zh ? "下载资料" : "Downloads"}</h2>{product.downloads.length ? <div className="card p-5">{product.downloads.map((download) => <a className="flex justify-between border-b py-3 text-brand-600 last:border-0" key={download.id} href={download.fileUrl} download><span>{download.title}<small className="block text-slate-500">{[download.fileType, download.fileSize].filter(Boolean).join(" · ")}</small></span><span aria-hidden="true">↓</span></a>)}</div> : <p className="muted">{zh ? "请联系销售团队获取此型号的最新规格书与适用文件。" : "Request the current datasheet and applicable documents for this model from our sales team."}</p>}</div>
      <div className="faq" id="product-faq"><h2 className="section-title mb-5">{zh ? "采购常见问题" : "Purchasing FAQ"}</h2>{faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p className="muted">{faq.answer}</p></details>)}</div>
    </div></section>

    {relatedProducts.length > 0 && <section className="section section-soft"><div className="container-site"><div className="center-head"><h2 className="section-title">{zh ? "比较同类产品" : "Compare Related Models"}</h2><p>{zh ? "查看同类产品的规格，再确认适合您项目的型号。" : "Review specifications across the same category before selecting a model for your project."}</p></div><ProductCards products={relatedProducts} detailLabel={zh ? "查看此型号" : "View This Model"} newLabel={zh ? "精选" : "FEATURED"} /><div className="product-sourcing-links"><Link href={categoryHref}>{zh ? `查看所有 ${category.name}` : `Explore All ${category.name}`} →</Link></div></div></section>}
    <section className="section"><div className="container-site"><div className="product-rfq-card"><div><h2>{zh ? "准备您的型号采购询盘" : "Prepare Your Model-Specific RFQ"}</h2><p>{zh ? `询盘时请注明 ${product.sku}，并提供数量、销售市场、品牌与包装要求及目标交付时间，帮助销售团队确认选项与项目报价。` : `Reference ${product.sku} and share the quantity, sales market, branding and packaging requirements, and target delivery date so our sales team can confirm options and quote your project.`}</p></div><Link href={quoteHref} className="btn btn-primary">{zh ? "提交项目需求" : "Send Your Project Brief"} →</Link></div></div></section>
  </>;
}
