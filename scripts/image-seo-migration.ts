/** Pure, narrowly scoped reference migration helpers; never replace arbitrary copy/links. */
export type OptimizedImageEntry = { src: string; width: number; height: number; alt: string; title: string };
export type ImageSeoManifest = Record<string, OptimizedImageEntry>;

export function localImagePath(value: unknown, origins: ReadonlySet<string>): string | undefined {
  if (typeof value !== "string" || !value.trim() || /^(?:data:|blob:)/i.test(value)) return;
  try {
    const url = new URL(value.trim(), "https://shanzesz.com");
    if (!value.trim().startsWith("/") || value.trim().startsWith("//")) {
      if (!origins.has(url.origin)) return;
    }
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes("\\") || pathname.includes("\0") || pathname.split("/").some((part) => part === ".." || part === ".")) return;
    return pathname;
  } catch { return; }
}

export function remapImage(value: unknown, manifest: ImageSeoManifest, origins: ReadonlySet<string>, absoluteOrigin?: string) {
  if (typeof value !== "string") return value;
  const source = localImagePath(value, origins);
  const entry = source && manifest[source];
  return entry ? (absoluteOrigin ? new URL(entry.src, absoluteOrigin).href : entry.src) : value;
}

function escapeAttribute(value: string) { return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function attributeValue(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
}

export function remapRichImages(html: string, manifest: ImageSeoManifest, origins: ReadonlySet<string>) {
  return html.replace(/<img\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi, (original) => {
    let tag = original;
    const source = attributeValue(tag, "src");
    const oldPath = localImagePath(source, origins);
    const entry = oldPath && manifest[oldPath];
    if (entry) {
      tag = tag.replace(/(\ssrc\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s>]+)/i, `$1"${escapeAttribute(entry.src)}"`);
      // Explicitly empty ALT can be intentional decoration: preserve it too.
      if (!/\salt(?:\s|=|\/?>)/i.test(tag)) tag = tag.replace(/\s*\/?\s*>$/, () => ` alt="${escapeAttribute(entry.alt)}">`);
      if (!/\stitle(?:\s|=|\/?>)/i.test(tag)) tag = tag.replace(/\s*\/?\s*>$/, () => ` title="${escapeAttribute(entry.title)}">`);
    }
    tag = tag.replace(/(\s(?:srcset|data-srcset)\s*=\s*)("|')([\s\S]*?)\2/gi, (_match: string, prefix: string, quote: string, value: string) => {
      const next = value.replace(/(^|,)(\s*)([^,\s]+)([^,]*)/g, (candidate: string, separator: string, whitespace: string, source: string, descriptor: string) => {
        const mapped = remapImage(source, manifest, origins);
        return mapped === source ? candidate : `${separator}${whitespace}${mapped}${descriptor}`;
      });
      return `${prefix}${quote}${next}${quote}`;
    });
    tag = tag.replace(/(\sdata-src\s*=\s*)("|')([^"']*)\2/gi, (_match: string, prefix: string, quote: string, value: string) => `${prefix}${quote}${escapeAttribute(String(remapImage(value, manifest, origins)))}${quote}`);
    return tag;
  });
}

const imageKeys = new Set(["image", "imageUrl", "imageURL", "coverImage", "hoverImage", "ogImage", "thumbnail", "thumbnailUrl", "thumbnailURL", "logo", "logoUrl", "logo_url", "src", "poster", "backgroundImage", "primaryImageOfPage"]);
const richKeys = new Set(["content", "description"]);

export function remapImageJson(value: string, manifest: ImageSeoManifest, origins: ReadonlySet<string>, schemaOrigin?: string) {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { return value; }
  let changed = false;
  function visit(node: unknown, imageContext = false): unknown {
    if (typeof node === "string") {
      const next = imageContext ? remapImage(node, manifest, origins, schemaOrigin) : node;
      if (next !== node) changed = true;
      return next;
    }
    if (Array.isArray(node)) return node.map((item) => visit(item, imageContext));
    if (!node || typeof node !== "object") return node;
    const object = node as Record<string, unknown>;
    const types = Array.isArray(object["@type"]) ? object["@type"] : [object["@type"]];
    const isImageObject = types.includes("ImageObject") || types.includes("https://schema.org/ImageObject");
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(object)) {
      if (richKeys.has(key) && typeof child === "string" && !schemaOrigin) {
        next[key] = remapRichImages(child, manifest, origins);
        if (next[key] !== child) changed = true;
      } else {
        const childIsImage = imageKeys.has(key) || ((imageContext || isImageObject) && ["url", "contentUrl", "@id"].includes(key));
        next[key] = visit(child, childIsImage);
      }
    }
    if (schemaOrigin && (isImageObject || imageContext)) {
      const source = [object.contentUrl, object.url, object.src, object["@id"]].find((item) => typeof item === "string" && localImagePath(item, origins) && manifest[localImagePath(item, origins)!]);
      const key = localImagePath(source, origins);
      const entry = key && manifest[key];
      if (entry) {
        if (next.width !== entry.width || next.height !== entry.height) changed = true;
        next.width = entry.width; next.height = entry.height;
      }
    }
    return next;
  }
  const next = visit(parsed);
  return changed ? JSON.stringify(next) : value;
}

export function collectJsonImages(value: string): Array<{ image: string; label?: string; alt?: string }> {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { return []; }
  const result: Array<{ image: string; label?: string; alt?: string }> = [];
  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const item = node as Record<string, unknown>;
    for (const [key, child] of Object.entries(item)) {
      if (imageKeys.has(key) && typeof child === "string") result.push({ image: child, label: String(item.title || item.name || ""), alt: typeof item.alt === "string" ? item.alt : undefined });
      else if (child && typeof child === "object") walk(child);
    }
  }
  walk(parsed);
  return result;
}
