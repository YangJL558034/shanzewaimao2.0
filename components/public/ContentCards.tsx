import Link from "next/link";
import { Cog, Magnet, PackageCheck, PenTool, ShieldCheck, Zap } from "lucide-react";
import { safeJson } from "@/lib/utils";
import { getVideoEmbedUrl, visualMediaKind } from "@/lib/media-url";

const positions = ["0 -630px", "25% -630px", "50% -630px", "75% -630px", "100% -630px", "0 -910px", "25% -910px", "50% -910px", "75% -910px", "100% -910px"];

type CategoryCardData = { id: string; name: string; slug: string; description: string | null; image: string | null };

export function CategoryCard({ category, index, viewLabel = "View More" }: { category: CategoryCardData; index: number; viewLabel?: string }) {
  return <article className="card category-card"><div className="card-art" style={{ "--art-image": `url(${category.image || "/references/products.png"})`, "--art-position": category.image ? "center" : positions[index%positions.length], "--art-size": category.image ? "contain" : "940px auto" } as React.CSSProperties}/><div className="card-body"><h3>{category.name}</h3><p>{category.description}</p><Link className="text-link" href={`/products?category=${category.slug}`}>{viewLabel} →</Link></div></article>;
}

export function CategoryCards({ categories, viewLabel = "View More" }: { categories: CategoryCardData[]; viewLabel?: string }) {
  return <div className="grid-cards category-grid">{categories.map((category,i)=><CategoryCard category={category} index={i} viewLabel={viewLabel} key={category.id}/>)}</div>;
}

type ProductCardData = {
  id: string;
  name: string;
  slug: string;
  coverImage: string | null;
  hoverImage: string | null;
  features: string;
  isFeatured: boolean;
};

function PrimaryProductMedia({ source, position }: { source: string | null; position: string }) {
  const mediaKind = visualMediaKind(source);
  if (mediaKind === "video") return <div className="card-art product-card-video product-card-primary-media"><video src={source || undefined} autoPlay muted loop playsInline preload="metadata" /></div>;
  if (mediaKind === "embed") return <div className="card-art product-card-video product-card-primary-media"><iframe src={getVideoEmbedUrl(source || "", true) || undefined} title="" tabIndex={-1} allow="autoplay; encrypted-media; picture-in-picture" /></div>;
  return <div className={`card-art product-card-primary-media ${source ? "product-card-image-adaptive" : ""}`} style={{ "--art-image": `url(${source || "/references/products.png"})`, "--art-position": source ? "center" : position, "--art-size": source ? "contain" : "940px auto" } as React.CSSProperties} />;
}

export function ProductCards({ products, detailLabel = "View Details", newLabel = "NEW" }: { products: ProductCardData[]; detailLabel?: string; newLabel?: string }) {
  return <div className="grid-cards product-grid">{products.map((product, i) => {
    const features = safeJson<{ title?: string }[]>(product.features, []);
    return <article className={`card product-card ${product.hoverImage ? "has-hover-image" : ""}`} key={product.id}>
      {product.isFeatured && <span className="absolute left-0 top-0 z-10 rounded-br bg-brand-600 px-2 py-1 text-[10px] font-bold text-white">{newLabel}</span>}
      <div className="product-card-media" aria-label={product.name}>
        <PrimaryProductMedia source={product.coverImage} position={positions[i % positions.length]} />
        {product.hoverImage && <div className="card-art product-card-hover-media product-card-image-adaptive" style={{ "--art-image": `url(${product.hoverImage})`, "--art-position": "center", "--art-size": "contain" } as React.CSSProperties} />}
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
