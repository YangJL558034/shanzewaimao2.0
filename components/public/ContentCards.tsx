"use client";
import Link from "next/link";
import { SeoImage } from "@/components/public/SeoImage";
import { Cog, Magnet, PackageCheck, PenTool, ShieldCheck, Zap } from "lucide-react";
import { safeJson } from "@/lib/utils";
import { getVideoEmbedUrl, visualMediaKind } from "@/lib/media-url";
import { productImageSource } from "@/lib/product-image";
import "./product-media.css";

export type CategoryCardData = { id: string; name: string; slug: string; description: string | null; image: string | null };

export function CategoryCard({ category, index, viewLabel = "View More", onSelect, selected = false }: { category: CategoryCardData; index: number; viewLabel?: string; onSelect?: (category: CategoryCardData) => void; selected?: boolean }) {
  const image = productImageSource(category.image);
  return <article className={`card category-card ${selected ? "is-selected" : ""}`}>{image?<div className="card-art next-image-art"><SeoImage src={image} alt={`${category.name} product category`} fill sizes="(max-width: 700px) 100vw, 20vw" /></div>:<div className="card-art product-media-placeholder" aria-hidden="true"><PackageCheck size={42} strokeWidth={1.25}/></div>}<div className="card-body"><h3>{category.name}</h3><p>{category.description}</p>{onSelect ? <button type="button" className="text-link category-select-button" onClick={() => onSelect(category)}>{viewLabel} →</button> : <Link className="text-link" href={`/products?category=${category.slug}`}>{viewLabel} →</Link>}</div></article>;
}

export function CategoryCards({ categories, viewLabel = "View More", onSelect, selectedSlug }: { categories: CategoryCardData[]; viewLabel?: string; onSelect?: (category: CategoryCardData) => void; selectedSlug?: string }) {
  return <div className="grid-cards category-grid">{categories.map((category,i)=><CategoryCard category={category} index={i} viewLabel={viewLabel} onSelect={onSelect} selected={selectedSlug === category.slug} key={category.id}/>)}</div>;
}

export type ProductCardData = {
  id: string;
  name: string;
  slug: string;
  coverImage: string | null;
  hoverImage: string | null;
  features: string;
  isFeatured: boolean;
  categoryId: string;
};

function PrimaryProductMedia({ source, alt }: { source: string | null; alt: string }) {
  const mediaKind = visualMediaKind(source);
  if (mediaKind === "video") return <div className="card-art product-card-video product-card-primary-media"><video src={source || undefined} autoPlay muted loop playsInline preload="metadata" /></div>;
  if (mediaKind === "embed") return <div className="card-art product-card-video product-card-primary-media"><iframe src={getVideoEmbedUrl(source || "", true) || undefined} title="" tabIndex={-1} allow="autoplay; encrypted-media; picture-in-picture" /></div>;
  const image = productImageSource(source);
  return image ? <div className="card-art product-card-primary-media product-card-image-adaptive next-image-art"><SeoImage src={image} alt={alt} fill sizes="(max-width: 700px) 100vw, 20vw" /></div> : <div className="card-art product-card-primary-media product-media-placeholder" aria-hidden="true"><PackageCheck size={42} strokeWidth={1.25}/></div>;
}

export function ProductCards({ products, detailLabel = "View Details", newLabel = "NEW" }: { products: ProductCardData[]; detailLabel?: string; newLabel?: string }) {
  return <div className="grid-cards product-grid">{products.map((product) => {
    const features = safeJson<{ title?: string }[]>(product.features, []);
    const hoverImage = productImageSource(product.hoverImage);
    return <article className={`card product-card ${hoverImage ? "has-hover-image" : ""}`} key={product.id}>
      {product.isFeatured && <span className="absolute left-0 top-0 z-10 rounded-br bg-brand-600 px-2 py-1 text-[10px] font-bold text-white">{newLabel}</span>}
      <div className="product-card-media" aria-label={product.name}>
        <PrimaryProductMedia source={product.coverImage} alt={product.name} />
        {hoverImage && <div className="card-art product-card-hover-media product-card-image-adaptive next-image-art"><SeoImage src={hoverImage} alt={`${product.name} additional product view`} fill sizes="(max-width: 700px) 100vw, 20vw" /></div>}
      </div>
      <div className="card-body"><h3>{product.name}</h3><div className="chips">{features.slice(0, 2).map((feature, index) => <span className="chip" key={index}>{feature.title || "OEM Ready"}</span>)}</div><Link className="btn btn-primary btn-sm" href={`/products/${product.slug}`}>{detailLabel}</Link></div>
    </article>;
  })}</div>;
}

export function FeatureCards({ features }: { features?: { title: string; text: string }[] }) {
  const list=features||[{title:"Strong Magnetic Alignment",text:"Secure attachment and stable charging without slipping."},{title:"Fast Wireless Charging",text:"Reliable high-efficiency output for modern devices."},{title:"Slim & Portable Design",text:"Premium engineering that fits any lifestyle."},{title:"Safe Battery Protection",text:"Built-in multi-protection systems keep devices safe."},{title:"OEM Customization",text:"Logo, color, packaging and capacity matched to your brand."}];
  const icons=[Magnet,Zap,PackageCheck,ShieldCheck,Cog];
  return <div className="grid-cards feature-grid">{list.map((f,i)=>{const Icon=icons[i%icons.length];return <article className="card feature-card" key={f.title}><span className="icon-badge"><Icon size={22}/></span><h3>{f.title}</h3><p>{f.text}</p></article>})}</div>;
}
