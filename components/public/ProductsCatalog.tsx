"use client";

import { useState } from "react";
import { CategoryCards, ProductCards, type CategoryCardData, type ProductCardData } from "@/components/public/ContentCards";

type SectionCopy = { title: string; subtitle: string | null; content: string | null; buttonLabel: string | null };

export function ProductsCatalog({
  categories,
  products,
  categoriesSection,
  featuredSection,
  initialCategory,
  labels,
}: {
  categories: CategoryCardData[];
  products: ProductCardData[];
  categoriesSection: SectionCopy;
  featuredSection: SectionCopy;
  initialCategory?: string;
  labels: { categoryFallback: string; products: string; viewMore: string; viewDetails: string; new: string; empty: string };
}) {
  const [selectedSlug, setSelectedSlug] = useState(initialCategory || "");
  const selectedCategory = categories.find((item) => item.slug === selectedSlug);
  const visibleProducts = selectedCategory ? products.filter((item) => item.categoryId === selectedCategory.id) : products;

  function selectCategory(category: CategoryCardData) {
    setSelectedSlug(category.slug);
    const params = new URLSearchParams(window.location.search);
    params.set("category", category.slug);
    window.history.pushState(null, "", `${window.location.pathname}?${params.toString()}`);
    window.requestAnimationFrame(() => document.getElementById("featured-products")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return <>
    <section className="section"><div className="container-site"><div className="center-head"><div className="eyebrow">{categoriesSection.subtitle}</div><h2 className="section-title">{categoriesSection.title}</h2><p>{categoriesSection.content}</p></div><CategoryCards categories={categories} viewLabel={categoriesSection.buttonLabel || labels.viewMore} onSelect={selectCategory} selectedSlug={selectedSlug} /></div></section>
    <section className="section section-soft" id="featured-products"><div className="container-site"><div className="center-head"><div className="eyebrow">{featuredSection.subtitle}</div><h2 className="section-title">{selectedCategory ? `${selectedCategory.name} ${labels.products}` : featuredSection.title}</h2><p>{featuredSection.content}</p></div>{visibleProducts.length ? <ProductCards products={visibleProducts} detailLabel={featuredSection.buttonLabel || labels.viewDetails} newLabel={labels.new} /> : <div className="products-empty-state">{labels.empty}</div>}</div></section>
  </>;
}
