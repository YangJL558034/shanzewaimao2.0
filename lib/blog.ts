import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const blogCategorySlugs = ["industry-insights", "industry-guides", "oem-guides", "buying-guides"] as const;

export function isBlogCategorySlug(slug: string) {
  return (blogCategorySlugs as readonly string[]).includes(slug);
}

export const blogWhereFilter: Prisma.NewsWhereInput = {
  status: "PUBLISHED",
  category: { slug: { in: [...blogCategorySlugs] } },
};

export const getPublishedBlogPost = cache((slug: string) => db.news.findFirst({
  where: { ...blogWhereFilter, slug },
  include: { category: true },
}));

export type BlogBlock =
  | { type: "heading"; level: 2 | 3; text: string; id: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] };

/** The CMS uses plain text. Parse a small Markdown subset without evaluating HTML. */
export function parseBlogContent(content: string): BlogBlock[] {
  const blocks: BlogBlock[] = [];
  const headings = new Map<string, number>();
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  let items: string[] = [];
  let ordered = false;
  function flushParagraph() {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  }
  function flushList() {
    if (items.length) blocks.push({ type: "list", ordered, items });
    items = [];
  }
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const list = line.match(/^([-*+] |\d+\. )(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const text = heading[2];
      const base = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "section";
      const count = (headings.get(base) || 0) + 1;
      headings.set(base, count);
      blocks.push({ type: "heading", level: heading[1].length > 2 ? 3 : 2, text, id: count > 1 ? `${base}-${count}` : base });
    } else if (list) {
      flushParagraph();
      const nextOrdered = /^\d/.test(list[1]);
      if (items.length && nextOrdered !== ordered) flushList();
      ordered = nextOrdered; items.push(list[2]);
    } else {
      flushList(); paragraph.push(line);
    }
  }
  flushParagraph(); flushList();
  return blocks;
}

export function readingMinutes(content: string) {
  const chineseCharacters = (content.match(/[\u3400-\u9fff]/g) || []).length;
  const words = content.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(Math.max(words / 220, chineseCharacters / 350)));
}
