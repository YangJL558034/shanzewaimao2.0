import { safeJson } from "@/lib/utils";

type ProductIdentity = { name: string; slug: string; category?: { name: string; slug: string } };
type BuyerCheck = { title: string; text: string };
export type ProductFaq = { question: string; answer: string };

export function productSpecifications(value: string | null | undefined): Record<string, string> {
  const parsed = safeJson<unknown>(value, {});
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string | number] =>
    Boolean(entry[0].trim()) && (typeof entry[1] === "string" || typeof entry[1] === "number"),
  ).map(([key, item]) => [key, String(item)]));
}

export function productContentCards(value: string | null | undefined): BuyerCheck[] {
  const parsed = safeJson<unknown>(value, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is BuyerCheck => Boolean(item) && typeof item.title === "string" && typeof item.text === "string");
}

export function productFaqs(value: string | null | undefined, zh: boolean): ProductFaq[] {
  const parsed = safeJson<unknown>(value, []);
  const authored = Array.isArray(parsed) ? parsed.filter((item): item is ProductFaq =>
    Boolean(item) && typeof item.question === "string" && Boolean(item.question.trim()) && typeof item.answer === "string" && Boolean(item.answer.trim()),
  ) : [];
  const purchasing: ProductFaq[] = zh ? [
    { question: "获取此型号报价需要提供哪些信息？", answer: "请提供型号或 SKU、预计数量、销售国家、充电与兼容性要求、品牌和包装需求，以及目标交付时间。销售团队将据此确认可行配置并提供报价。" },
    { question: "批量采购前应确认哪些事项？", answer: "请确认具体样品、最终规格、品牌与包装文件，以及目标市场所需资料。起订量、样品费用、生产周期和贸易条款将在项目评审后确认。" },
  ] : [
    { question: "What information is needed to quote this model?", answer: "Share the model or SKU, estimated order quantity, sales country, charging and compatibility requirements, branding and packaging brief, and target delivery date. The sales team will review the available configuration and prepare a project quotation." },
    { question: "What should be confirmed before a bulk order?", answer: "Confirm the selected sample, final specification, branding and packaging artwork, and documents required for the target market. Minimum order quantity, sample cost, production schedule and trade terms are agreed after project review." },
  ];
  return [...authored, ...purchasing.filter((item) => !authored.some((faq) => faq.question.toLowerCase() === item.question.toLowerCase()))];
}

export function productSourcingGuide(product: ProductIdentity, zh: boolean) {
  const identity = `${product.name} ${product.slug}`.toLowerCase();
  const magnetic = /magnetic/.test(identity) && /power[\s-]?bank/.test(identity);
  const powerBank = /power[\s-]?bank/.test(identity);
  const wireless = /wireless[\s-]?charg/.test(identity);
  const type = magnetic ? "magnetic" : powerBank ? "power-bank" : wireless ? "wireless" : "accessory";
  const landing = magnetic ? "/magnetic-power-bank-oem" : powerBank ? "/power-bank-manufacturer" : wireless ? "/wireless-charger-manufacturer" : "/products";
  const guide = magnetic ? "/blog/magnetic-power-bank-oem-project-checklist" : powerBank ? "/blog/how-to-choose-power-bank-manufacturer" : wireless ? "/blog/wireless-charger-manufacturer-sourcing-guide" : "/blog";
  const keyword = magnetic ? "Magnetic Power Bank OEM" : powerBank ? "Power Bank Manufacturer" : wireless ? "Wireless Charger Manufacturer" : "OEM Charging Product Sourcing";
  const checks: BuyerCheck[] = zh ? [
    { title: "产品与设备匹配", text: magnetic ? "提供目标手机、保护壳及磁吸附件信息，并通过所选样品确认吸附、接口和充电体验。" : wireless ? "提供目标手机及其他设备清单，并确认设备摆放、保护壳、适配器和充电组合。" : powerBank ? "提供使用设备、目标容量、所需接口和输出要求，以核对具体型号的规格。" : "提供目标设备、使用场景和所需接口或电源要求，以确认型号是否适合项目。" },
    { title: "品牌与包装方案", text: "提供 Logo、配色、包装类型及说明书语言需求。具体定制选项需要按型号确认后安排打样。" },
    { title: "目标市场与文件", text: "告知销售国家、客户渠道及所需文件。请在下单前确认所选型号及配置对应的报告和资料。" },
    { title: "数量与交付计划", text: "提供首次订单数量、补货预期和目标交付时间。起订量、价格、样品与生产安排将在项目评审后确认。" },
  ] : [
    { title: "Device and charging fit", text: magnetic ? "List the target phones, cases and magnetic accessories. Validate attachment, ports and charging behavior with the selected sample." : wireless ? "List target phones and other devices. Review device placement, cases, adapter requirements and simultaneous charging needs." : powerBank ? "Specify the devices, capacity target, ports and output requirements to compare against the selected model's published specification." : "Share the target devices, use case and connector or power requirements so the selected model can be reviewed for your project." },
    { title: "Branding and packaging", text: "Share your logo, color direction, packaging format and manual languages. Model-specific customization options need confirmation before sampling." },
    { title: "Market and documentation", text: "Identify the sales country, distribution channel and required documents. Confirm reports and supporting files for the chosen model and configuration before ordering." },
    { title: "Quantity and delivery plan", text: "Provide an initial order quantity, reorder expectation and target arrival date. MOQ, pricing, samples and production timing are confirmed after project review." },
  ];
  return { type, keyword, landing, guide, checks, landingLabel: zh ? magnetic ? "磁吸充电宝 OEM 方案" : powerBank ? "充电宝制造商与采购" : wireless ? "无线充电器制造商与采购" : "比较充电产品型号" : type === "accessory" ? "Compare Charging Product Models" : keyword, guideLabel: zh ? "阅读采购指南" : type === "accessory" ? "Explore OEM sourcing guides" : "Read the sourcing guide for this product" };
}

export function productMetadataFallback(name: string, zh: boolean) {
  return {
    title: zh ? `${name} | OEM/ODM 定制与批量采购 | Shanze` : `${name} | OEM/ODM Supplier | Shanze`,
    description: zh ? `查看 ${name} 的产品规格与定制选项。联系 Shanze 确认品牌、包装、样品及批量订单方案，并获取项目报价。` : `${name} from Shanze for OEM/ODM sourcing. Compare specifications; request branding, packaging, samples and bulk-order quotes.`,
  };
}
