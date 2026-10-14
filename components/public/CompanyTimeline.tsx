import type { PageContentItem } from "@/lib/page-content";
import { SeoImage } from "@/components/public/SeoImage";

export function CompanyTimeline({ items, label }: { items: PageContentItem[]; label: string }) {
  if (!items.length) return null;
  return <ol className="company-timeline" aria-label={label}>
    {items.map((item, index) => {
      const year = item.value?.match(/^(\d{4})(?:年)?$/)?.[1];
      return <li className="company-timeline-milestone" key={`${item.value || "milestone"}-${index}`}>
        {item.value && <time className="company-timeline-date" dateTime={year}>{item.value}</time>}
        <div className="company-timeline-card">
          {item.title && <h3>{item.title}</h3>}
          {item.text && <p>{item.text}</p>}
          {item.image && <SeoImage src={item.image} alt={item.title || label} loading="lazy" sizes="(max-width: 700px) 100vw, 25vw" />}
        </div>
      </li>;
    })}
  </ol>;
}
