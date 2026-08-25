import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BatteryCharging, Magnet, PackageCheck, PlugZap, ShieldCheck, Zap } from "lucide-react";
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
  const product = await db.product.findUnique({ where: { slug }, select: { name: true, summary: true, coverImage: true } });
  const socialImage = product?.coverImage && visualMediaKind(product.coverImage) === "image" ? product.coverImage : undefined;
  return product ? { title: product.name, description: product.summary, openGraph: { images: socialImage ? [socialImage] : [] } } : {};
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
    <JsonLd data={{"@context":"https://schema.org","@type":"Product",name:product.name,sku:product.sku,description:product.summary,image:product.coverImage&&visualMediaKind(product.coverImage)==="image"?[absoluteUrl(product.coverImage)]:[],brand:{"@type":"Brand",name:"ENERCORE"},manufacturer:{"@type":"Organization",name:"ENERCORE Technology Co., Ltd."},category:category.name,url:absoluteUrl(`/products/${product.slug}`)}}/>
    <div className="container-site"><div className="py-4 text-xs text-slate-500"><Link href="/">{zh?"首页":"Home"}</Link>　›　<Link href="/products">{zh?"产品中心":"Products"}</Link>　›　{product.name}</div><section className="product-detail-top"><ProductGallery images={galleryImages} productName={product.name}/><div><div className="eyebrow">{category.name} · {product.sku}</div><h1 className="detail-title">{product.name}</h1><p className="text-lg font-semibold">{product.tagline}</p><p className="section-copy">{product.summary}</p><div className="grid-cards detail-features">{[[BatteryCharging,zh?"高容量":"High Capacity",zh?"满足全天商务使用":"All-day business reliability"],[Magnet,zh?"强力磁吸":"Strong Magnetic",zh?"精准稳定对齐":"Precise and stable alignment"],[Zap,zh?"快速充电":"Fast Charging",zh?"高效无线输出":"Efficient wireless output"],[PlugZap,"USB-C PD",zh?"通用输入与输出":"Universal input and output"],[ShieldCheck,zh?"多重保护":"Multi-Protection",zh?"安全并通过认证":"Safe and certified"],[PackageCheck,zh?"支持 OEM":"OEM Ready",zh?"品牌与包装定制":"Custom brand and packaging"]].map(([Icon,t,s])=>{const C=Icon as typeof Zap;return <div className="detail-feature" key={String(t)}><span className="icon-badge"><C size={20}/></span><span><strong>{String(t)}</strong><span>{String(s)}</span></span></div>})}</div><div className="flex flex-wrap gap-4"><Link className="btn btn-primary" href={`/contact?product=${product.slug}#quote`}>{zh?"获取报价":"Get a Quote"}</Link><a className="btn btn-outline" href="mailto:sales@enercore.com">{zh?"联系销售":"Contact Sales"}</a></div><p className="mt-5 text-xs text-slate-500">{zh?"支持 OEM 批量订单　•　全球发货　•　服务 100+ 国家":"Bulk OEM orders welcome　•　Global shipping　•　100+ countries"}</p></div></section></div>
    <section className="section section-soft"><div className="container-site"><div className="center-head"><h2 className="section-title">{zh?"核心卖点":"Key Features"}</h2></div><FeatureCards features={features}/></div></section>
    <section className="section"><div className="container-site spec-grid"><div><h2 className="section-title mb-5">{zh?"技术规格":"Technical Specifications"}</h2><table className="spec-table"><tbody>{Object.entries(specs).map(([key,value])=><tr key={key}><th>{key}</th><td>{value}</td></tr>)}</tbody></table></div><div><h2 className="section-title mb-5">{zh?"选项与包装内容":"Options & What’s in the Box"}</h2><div className="card p-6"><h3>{zh?"灵活 OEM 配置":"Flexible OEM Configuration"}</h3><p className="muted">{zh?"可选择颜色、电池容量、配件、线材、说明书和定制零售包装；客户经理将在打样前确认规格。":"Select colors, battery capacity, accessories, cables, manuals and custom retail packaging. Your account manager will confirm specifications before sampling."}</p><ul className="check-list"><li>{zh?"Logo 和颜色定制":"Logo and color customization"}</li><li>{zh?"产品与包装画面定制":"Custom product and packaging artwork"}</li><li>{zh?"地区化说明书与合规标识":"Regional manuals and compliance marks"}</li><li>{zh?"配件和礼盒选项":"Accessories and gift box options"}</li></ul></div></div></div></section>
    {apps.length>0&&<section className="section section-soft"><div className="container-site"><div className="center-head"><h2 className="section-title">{zh?"适用于多种场景":"Designed for Every Scenario"}</h2></div><div className="grid-cards grid-cols-1 md:grid-cols-4">{apps.map((a)=><article className="card p-5" key={a.title}><h3>{a.title}</h3><p className="muted">{a.text}</p></article>)}</div></div></section>}
    <section className="section"><div className="container-site spec-grid"><div><h2 className="section-title mb-5">{zh?"下载资料":"Downloads"}</h2>{product.downloads.length?<div className="card p-5">{product.downloads.map((d)=><a className="flex justify-between border-b py-3 text-brand-600 last:border-0" key={d.id} href={d.fileUrl} download><span>{d.title}<small className="block text-slate-500">{d.fileType} · {d.fileSize}</small></span><span>↓</span></a>)}</div>:<p className="muted">{zh?"请联系销售团队获取最新规格书。":"Request current datasheets from our sales team."}</p>}</div><div className="faq"><h2 className="section-title mb-5">{zh?"常见问题":"FAQ"}</h2>{faqs.map((f)=><details key={f.question}><summary>{f.question}</summary><p className="muted">{f.answer}</p></details>)}</div></div></section>
  </>;
}
