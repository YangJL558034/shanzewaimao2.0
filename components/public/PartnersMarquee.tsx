import type { CSSProperties } from "react";

type PartnerItem = {
  title?: string;
  text?: string;
  value?: string;
  image?: string;
  href?: string;
};

function safePartnerHref(value?: string) {
  const href = value?.trim();
  if (!href) return undefined;
  if (href.startsWith("/") || /^https:\/\//i.test(href)) return href;
  return undefined;
}

function PartnerCard({ item, duplicate = false }: { item: PartnerItem; duplicate?: boolean }) {
  const href = safePartnerHref(item.href);
  const content = <>
    <span className="partner-logo">
      {item.image
        ? <img src={item.image} alt={`${item.title || "Partner"} logo`} loading="lazy" />
        : <span aria-hidden="true">{(item.title || "P").slice(0, 2).toUpperCase()}</span>}
    </span>
    <span className="partner-copy">
      <strong>{item.title || "Partner"}</strong>
      {item.text && <small>{item.text}</small>}
    </span>
    {item.value && <span className="partner-type">{item.value}</span>}
  </>;

  return href
    ? <a className="partner-card" href={href} tabIndex={duplicate ? -1 : undefined} target={href.startsWith("https://") ? "_blank" : undefined} rel={href.startsWith("https://") ? "noreferrer" : undefined}>{content}</a>
    : <article className="partner-card">{content}</article>;
}

export function PartnersMarquee({
  items,
  label,
  fallbackImage,
  fallbackImageTitle,
}: {
  items: PartnerItem[];
  label: string;
  fallbackImage?: string | null;
  fallbackImageTitle?: string | null;
}) {
  const normalizedFallbackTitle = fallbackImageTitle?.trim().toLocaleLowerCase();
  const partners = items
    .filter((item) => item.title || item.image)
    .map((item) => ({
      ...item,
      image: item.image || (
        fallbackImage
        && normalizedFallbackTitle
        && item.title?.trim().toLocaleLowerCase() === normalizedFallbackTitle
          ? fallbackImage
          : ""
      ),
    }));
  if (!partners.length) return null;
  const duration = Math.max(22, partners.length * 4);

  return <div className="partners-marquee" role="region" aria-label={label} style={{ "--partner-duration": `${duration}s` } as CSSProperties}>
    <div className="partners-marquee-fade is-left" />
    <div className="partners-marquee-track">
      {[0, 1].map((copy) => <div className="partners-marquee-group" aria-hidden={copy === 1} key={copy}>
        {partners.map((item, index) => <PartnerCard item={item} duplicate={copy === 1} key={`${copy}-${item.title || "partner"}-${index}`} />)}
      </div>)}
    </div>
    <div className="partners-marquee-fade is-right" />
  </div>;
}
