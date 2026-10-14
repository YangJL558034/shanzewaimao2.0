/** Page reference screenshots must never stand in for a product photograph. */
export function productImageSource(value: string | null | undefined) {
  const source = value?.trim() || "";
  if (!source) return "";
  try {
    const url = new URL(source, "https://shanzesz.com");
    if (!["https:", "http:"].includes(url.protocol)) return "";
    return /^\/references\/(?:home|about|products|factory|quality|news|contact|product-detail)\.png$/i.test(url.pathname) ? "" : source;
  } catch { return ""; }
}
