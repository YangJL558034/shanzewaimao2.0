import Link from "next/link";
import type { ReactNode } from "react";
import type { BlogBlock } from "@/lib/blog";

/** Links are restricted to relative site routes and HTTPS, and React escapes all text. */
function inlineText(text: string): ReactNode[] {
  const tokens = text.split(/(\[[^\]\n]+\]\([^\s)]+\)|\*\*[^*\n]+\*\*)/g);
  return tokens.map((token, index) => {
    const link = token.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (link) {
      const [, label, href] = link;
      if (href.startsWith("/") && !href.startsWith("//") && !href.includes("\\")) return <Link key={index} href={href}>{label}</Link>;
      if (/^https:\/\/[^\s<>]+$/i.test(href)) return <a key={index} href={href} rel="noopener noreferrer">{label}</a>;
      return label;
    }
    const strong = token.match(/^\*\*([^*]+)\*\*$/);
    return strong ? <strong key={index}>{strong[1]}</strong> : token;
  });
}

export function BlogContent({ blocks }: { blocks: BlogBlock[] }) {
  return <div className="blog-prose">{blocks.map((block, index) => {
    if (block.type === "heading") return block.level === 2
      ? <h2 key={index} id={block.id}>{inlineText(block.text)}</h2>
      : <h3 key={index} id={block.id}>{inlineText(block.text)}</h3>;
    if (block.type === "list") {
      const children = block.items.map((item, itemIndex) => <li key={itemIndex}>{inlineText(item)}</li>);
      return block.ordered ? <ol key={index}>{children}</ol> : <ul key={index}>{children}</ul>;
    }
    return <p key={index}>{inlineText(block.text)}</p>;
  })}</div>;
}
