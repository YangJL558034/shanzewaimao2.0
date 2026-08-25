import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function pdfEscape(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/([\\()])/g, "\\$1");
}

function buildCatalogPdf(
  company: string,
  products: { name: string; sku: string; summary: string; category: { name: string } }[],
) {
  const pages: string[][] = [];
  const rows = products.length ? products : [{ name: "Product catalog", sku: "", summary: "Add published products in the CMS to populate this catalog.", category: { name: "ENERCORE" } }];
  for (let index = 0; index < rows.length; index += 9) {
    pages.push(rows.slice(index, index + 9).flatMap((product) => [
      `${product.name}  [${product.sku}]`,
      `${product.category.name} - ${product.summary}`,
      "",
    ]));
  }

  const objects: string[] = [];
  const add = (content: string) => {
    objects.push(content);
    return objects.length;
  };
  const catalogId = add("");
  const pagesId = add("");
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex];
    const commands = [
      "BT",
      "/F1 20 Tf",
      "54 780 Td",
      `(${pdfEscape(company)} Product Catalog) Tj`,
      "0 -30 Td",
      "/F1 10 Tf",
      `(Generated ${pdfEscape(new Date().toISOString().slice(0, 10))} - Page ${pageIndex + 1}/${pages.length}) Tj`,
      "0 -28 Td",
      ...lines.flatMap((line, lineIndex) => [
        lineIndex % 3 === 0 ? "/F1 12 Tf" : "/F1 9 Tf",
        `(${pdfEscape(line).slice(0, 100)}) Tj`,
        "0 -19 Td",
      ]),
      "ET",
    ].join("\n");
    const contentId = add(`<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
}

export async function GET() {
  const [products, settings] = await Promise.all([
    db.product.findMany({
      where: { status: "PUBLISHED" },
      select: { name: true, sku: true, summary: true, category: { select: { name: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.setting.findMany({ where: { key: { in: ["company_name", "site_name"] } } }),
  ]);
  const map = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
  const pdf = buildCatalogPdf(map.company_name || map.site_name || "ENERCORE", products);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="enercore-product-catalog.pdf"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
