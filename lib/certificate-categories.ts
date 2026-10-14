/** Shared by CMS, server handlers, migrations and the public gallery. */
export const certificateCategories = ["MANAGEMENT", "PRODUCT"] as const;
export type CertificateCategory = typeof certificateCategories[number];

export const certificateCategoryOptions: { label: string; value: CertificateCategory }[] = [
  { label: "管理体系", value: "MANAGEMENT" },
  { label: "产品认证与报告", value: "PRODUCT" },
];

export function isCertificateCategory(value: unknown): value is CertificateCategory {
  return value === "MANAGEMENT" || value === "PRODUCT";
}

/** Only a legacy fallback. Once stored, a CMS selection is authoritative. */
export function inferCertificateCategory(name: string): CertificateCategory {
  return /^\s*(?:ISO(?:\b|(?=\d))|IATF(?:\b|(?=\d))|AS\s*9100\b|SA\s*8000\b|BSCI\b|Sedex\b)/i.test(name)
    ? "MANAGEMENT"
    : "PRODUCT";
}

export function resolveCertificateCategory(category: unknown, name = ""): CertificateCategory {
  if (isCertificateCategory(category)) return category;
  return category === null || category === undefined ? inferCertificateCategory(name) : "PRODUCT";
}

export function parseCertificateCategory(value: unknown): CertificateCategory {
  if (!isCertificateCategory(value)) throw new Error("请选择有效的证书分类：管理体系或产品认证与报告。");
  return value;
}
