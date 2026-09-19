import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { FeatureCards } from "@/components/public/ContentCards";
import { safeJson } from "@/lib/utils";
import { JsonLd } from "@/components/public/JsonLd";
import { absoluteUrl } from "@/lib/utils";
import { getLocale, translateEntity } from "@/lib/i18n";
import { ProductGallery } from "@/components/public/ProductGallery";
import { visualMediaKind } from "@/lib/media-url";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await db.product.findUnique({ where: { slug }, include: { category: { select: { name: true } } } });
  if (!product || product.status !== "PUBLISHED") return {};
  const title = product.seoTitle || `${product.name} | OEM/ODM ${product.category.name} | Shanze`;
  const description = product.metaDescription || `${product.name} by Shanze. ${product.summary}`.slice(0, 160);
  const canonical = product.canonical && !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(product.canonical) ? product.canonical : absoluteUrl(`/products/${product.slug}`);
  const socialImage = product.ogImage ? absoluteUrl(product.ogImage) : product.coverImage && visualMediaKind(product.coverImage) === "image" ? absoluteUrl(product.coverImage) : absoluteUrl("/references/home.png");
  return { title: { absolute: title }, description, alternates: { canonical }, robots: product.noIndex ? { index: false, follow: false } : { index: true, follow: true }, openGraph: { type: "website", title: product.ogTitle || title, description: product.ogDescription || description, url: canonical, images: [socialImage] }, twitter: { card: "summary_large_image", title: product.ogTitle || title, description: product.ogDescription || description, images: [socialImage] } };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rawProduct = await db.product.findFirst({ where: { slug, status: "PUBLISHED" }, include: { category: true, downloads: true, images: { orderBy: { sortOrder: "asc" } } } });
  if (!rawProduct) notFound();
  const locale = await getLocale();
  const [product, category] = await Promise.all([
    translateEntity("Product", rawProduct, ["name", "tagline", "summary", "description", "specifications", "features", "applications", "faqs"], locale),
    translateEntity("ProductCategory", rawProduct.category, ["name"], locale),
  ]);
  const zh = locale === "zh";
  const galleryImages = [
    ...(product.coverImage ? [{ url: product.coverImage, alt: product.name }] : []),
    ...(product.hoverImage && product.hoverImage !== product.coverImage ? [{ url: product.hoverImage, alt: `${product.name} ${zh ? "反面" : "rear view"}` }] : []),
    ...product.images.map((image) => ({ url: image.url, alt: image.alt })),
    ...(!product.coverImage && !product.hoverImage && !product.images.length ? [{ url: "/references/product-detail.png", alt: product.name }] : []),
  ];
  const specs = safeJson<Record<string,string>>(product.specifications, {});
  const features = safeJson<{title:string;text:string}[]>(product.features, []);
  const apps = safeJson<{title:string;text:string}[]>(product.applications, []);
  const faqs = safeJson<{question:string;answer:string}[]>(product.faqs, []);
  return <>
    <JsonLd data={{"@context":"https://schema.org","@type":"Product",name:product.name,sku:product.sku,description:product.summary,image:galleryImages.filter((item)=>visualMediaKind(item.url)==="image").map((item)=>absoluteUrl(item.url)),brand:{"@type":"Brand",name:"Shanze"},manufacturer:{"@type":"Organization",name:"Shanze New Energy Technology Co., Ltd.",url:absoluteUrl("/")},category:category.name,url:absoluteUrl(`/products/${product.slug}`)}}/>
    <JsonLd data={{"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Home",item:absoluteUrl("/")},{"@type":"ListItem",position:2,name:"Products",item:absoluteUrl("/products")},{"@type":"ListItem",position:3,name:product.name,item:absoluteUrl(`/products/${product.slug}`)}]}}/>
    {faqs.length>0&&<JsonLd data={{"@context":"https://schema.org","@type":"FAQPage",mainEntity:faqs.map((faq)=>({"@type":"Question",name:faq.question,acceptedAnswer:{"@type":"Answer",text:faq.answer}}))}}/>}
    <div className="container-site"><div className="py-4 text-xs text-slate-500"><Link href="/">{zh?"首页":"Home"}</Link>　›　<Link href="/products">{zh?"产品中心":"Products"}</Link>　›　{product.name}</div><section className="product-detail-top"><ProductGallery images={galleryImages} productName={product.name}/><div><div className="eyebrow">{category.name} · {product.sku}</div><h1 className="detail-title">{product.name}</h1><p className="text-lg font-semibold">{product.tagline}</p><p className="section-copy">{product.summary}</p><div className="flex flex-wrap gap-4"><Link className="btn btn-primary" href={`/contact?product=${product.slug}#quote`}>{zh?"获取报价":"Get a Quote"}</Link><a className="btn btn-outline" href="mailto:sales@shanzesz.com">{zh?"联系销售":"Contact Sales"}</a></div></div></section></div>
    <section className="section section-soft"><div className="container-site"><div className="center-head"><h2 className="section-title">{zh?"核心卖点":"Key Features"}</h2></div><FeatureCards features={features}/></div></section>
    <section className="section"><div className="container-site spec-grid"><div><h2 className="section-title mb-5">{zh?"技术规格":"Technical Specifications"}</h2><table className="spec-table"><tbody>{Object.entries(specs).map(([key,value])=><tr key={key}><th>{key}</th><td>{value}</td></tr>)}</tbody></table></div><div><h2 className="section-title mb-5">{zh?"选项与包装内容":"Options & What’s in the Box"}</h2><div className="card p-6"><h3>{zh?"灵活 OEM 配置":"Flexible OEM Configuration"}</h3><p className="muted">{zh?"所选型号可支持的产品、品牌、文件和包装选项将在打样前逐项确认。":"Available product, branding, documentation and packaging options are confirmed for the selected model before sampling."}</p><ul className="check-list"><li>{zh?"品牌展示方案确认":"Brand presentation review"}</li><li>{zh?"产品与包装画面确认":"Product and packaging artwork review"}</li><li>{zh?"目标市场文件确认":"Target-market documentation review"}</li><li>{zh?"可选配置确认":"Available configuration confirmation"}</li></ul></div></div></div></section>
    {apps.length>0&&<section className="section section-soft"><div className="container-site"><div className="center-head"><h2 className="section-title">{zh?"适用于多种场景":"Designed for Every Scenario"}</h2></div><div className="grid-cards grid-cols-1 md:grid-cols-4">{apps.map((a)=><article className="card p-5" key={a.title}><h3>{a.title}</h3><p className="muted">{a.text}</p></article>)}</div></div></section>}
    <section className="section"><div className="container-site spec-grid"><div><h2 className="section-title mb-5">{zh?"下载资料":"Downloads"}</h2>{product.downloads.length?<div className="card p-5">{product.downloads.map((d)=><a className="flex justify-between border-b py-3 text-brand-600 last:border-0" key={d.id} href={d.fileUrl} download><span>{d.title}<small className="block text-slate-500">{d.fileType} · {d.fileSize}</small></span><span>↓</span></a>)}</div>:<p className="muted">{zh?"请联系销售团队获取最新规格书。":"Request current datasheets from our sales team."}</p>}</div><div className="faq"><h2 className="section-title mb-5">{zh?"常见问题":"FAQ"}</h2>{faqs.map((f)=><details key={f.question}><summary>{f.question}</summary><p className="muted">{f.answer}</p></details>)}</div></div></section>
  </>;
}
