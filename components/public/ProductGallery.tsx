"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { getVideoEmbedUrl, visualMediaKind } from "@/lib/media-url";

export function ProductGallery({
  images,
  productName,
}: {
  images: { url: string; alt?: string | null }[];
  productName: string;
}) {
  const unique = images.filter(
    (image, index, all) =>
      image.url && all.findIndex((candidate) => candidate.url === image.url) === index,
  );
  const [active, setActive] = useState(0);
  const current = unique[active] || unique[0];
  const currentKind = visualMediaKind(current?.url);
  if (!current) return <div className="product-photo" />;
  return (
    <div className="product-gallery">
      <div className="product-gallery-main">
        {currentKind === "video" ? <video key={current.url} src={current.url} controls playsInline preload="metadata" /> : currentKind === "embed" ? <iframe key={current.url} src={getVideoEmbedUrl(current.url) || undefined} title={current.alt || productName} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : <img src={current.url} alt={current.alt || productName} />}
      </div>
      {unique.length > 1 && (
        <div className="product-gallery-thumbs" aria-label="Product images">
          {unique.map((image, index) => (
            <button
              type="button"
              key={image.url}
              className={active === index ? "active" : ""}
              onClick={() => setActive(index)}
              aria-label={`View media ${index + 1}`}
            >
              {visualMediaKind(image.url) === "image" ? <img src={image.url} alt={image.alt || `${productName} ${index + 1}`} /> : <span className="product-video-thumb"><Play size={19} fill="currentColor" /><small>VIDEO</small></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
