"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Factory, Globe2, PackageCheck, ShieldCheck } from "lucide-react";
import { getVideoEmbedProvider, getVideoEmbedUrl, visualMediaKind } from "@/lib/media-url";

export type HeroSlide = { id: string; image?: string | null; title: string; accent?: string | null; subtitle: string; ctaLabel: string; ctaHref: string };

export function Hero({ page, title, accent, subtitle, image, ctaLabel = "Learn More", ctaHref = "/about", slides }: { page: string; title: string; accent?: string | null; subtitle: string; image?: string | null; ctaLabel?: string; ctaHref?: string; slides?: HeroSlide[] }) {
  const slideList = useMemo<HeroSlide[]>(() => slides?.length ? slides : [{ id: "default", image, title, accent, subtitle, ctaLabel, ctaHref }], [slides, image, title, accent, subtitle, ctaLabel, ctaHref]);
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [slideList.length]);
  useEffect(() => {
    if (slideList.length < 2) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slideList.length), 2000);
    return () => window.clearInterval(timer);
  }, [slideList.length]);
  const slide = slideList[active] || slideList[0];
  const mediaKind = visualMediaKind(slide.image);
  const embedProvider = mediaKind === "embed" ? getVideoEmbedProvider(slide.image || "") : "unknown";
  const backgroundImage = mediaKind === "image" ? slide.image : `/references/${page}.png`;
  const hasVideoSlides = slideList.some((item) => ["video", "embed"].includes(visualMediaKind(item.image)));
  const move = (delta: number) => setActive((current) => (current + delta + slideList.length) % slideList.length);
  return <section className={`page-hero ${mediaKind === "video" || mediaKind === "embed" ? "has-video" : ""}`} style={{ "--hero-image": `url(${backgroundImage})` } as React.CSSProperties}>
    {mediaKind === "video" && <div className="hero-media-layer" aria-hidden="true"><video key={slide.id} src={slide.image || undefined} autoPlay muted loop playsInline preload="metadata" controls={false} controlsList="nodownload nofullscreen noplaybackrate" disablePictureInPicture /></div>}
    {mediaKind === "embed" && <div className={`hero-media-layer hero-media-embed hero-media-${embedProvider}`} aria-hidden="true"><iframe key={slide.id} src={getVideoEmbedUrl(slide.image || "", true) || undefined} title="" tabIndex={-1} loading="eager" allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" /></div>}
    <div className="container-site"><div className="hero-content">
      <h1 className="hero-title">{slide.title}<br/>{slide.accent && <strong>{slide.accent}</strong>}</h1>
      <p className="hero-subtitle">{slide.subtitle}</p>
      <div className="hero-points"><span className="hero-point"><Factory size={29} color="#0861df"/> OEM/ODM<br/>Solutions</span><span className="hero-point"><ShieldCheck size={29} color="#0861df"/> Quality First</span><span className="hero-point"><Globe2 size={29} color="#0861df"/> Global Export</span></div>
      <Link href={slide.ctaHref} className="btn btn-primary"><PackageCheck size={17}/>{slide.ctaLabel} →</Link>
    </div></div>
    {slideList.length > 1 && !hasVideoSlides && <>
      <button type="button" className="hero-arrow hero-arrow-prev" aria-label="上一张" onClick={() => move(-1)}><ChevronLeft size={22}/></button>
      <button type="button" className="hero-arrow hero-arrow-next" aria-label="下一张" onClick={() => move(1)}><ChevronRight size={22}/></button>
      <div className="hero-dots" aria-label="轮播图切换">{slideList.map((item, index) => <button type="button" key={item.id} className={`hero-dot ${index === active ? "active" : ""}`} aria-label={`第 ${index + 1} 张`} onClick={() => setActive(index)} />)}</div>
    </>}
  </section>;
}
