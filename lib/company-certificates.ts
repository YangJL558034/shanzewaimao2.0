/** Images extracted from company profile pages 19–20; match certificate text, not slide captions. */
const isoExpiresAt = "2026-10-08T15:59:59.999Z";
export const companyCertificates = [
  { name: "ISO 9001", issuer: "ZhongAn Certification Technology (Guangdong) Co., Ltd.", certificateNo: "97723Q0158R0S", image: "/company-profile/iso-9001-certificate.jpg", width: 1669, height: 2402, expiresAt: isoExpiresAt, sortOrder: 1, zh: { name: "ISO 9001 质量管理体系", issuer: "中安认证技术（广东）有限公司" } },
  { name: "ISO 14001", issuer: "ZhongAn Certification Technology (Guangdong) Co., Ltd.", certificateNo: "97723E0077R0S", image: "/company-profile/iso-14001-certificate.jpg", width: 1613, height: 2286, expiresAt: isoExpiresAt, sortOrder: 2, zh: { name: "ISO 14001 环境管理体系", issuer: "中安认证技术（广东）有限公司" } },
  { name: "ISO 45001", issuer: "ZhongAn Certification Technology (Guangdong) Co., Ltd.", certificateNo: "97723S0062R0S", image: "/company-profile/iso-45001-certificate.jpg", width: 1537, height: 2239, expiresAt: isoExpiresAt, sortOrder: 3, zh: { name: "ISO 45001 职业健康安全管理体系", issuer: "中安认证技术（广东）有限公司" } },
  { name: "PSE · BarryT i4", issuer: null, certificateNo: "ECTBF0A04C924", image: "/company-profile/barryt-i4-pse-report.jpg", width: 1489, height: 2105, expiresAt: null, sortOrder: 4, zh: { name: "PSE 检测资料 · BarryT i4", issuer: "" } },
  { name: "RoHS · BarryT i4", legacyName: "RoHS", issuer: "Shenzhen AZT Technology Co., Ltd.", certificateNo: "AZT260508092C-EV0", image: "/company-profile/barryt-i4-rohs-report.jpg", width: 1489, height: 2105, expiresAt: null, sortOrder: 5, zh: { name: "RoHS 检测资料 · BarryT i4", issuer: "深圳 AZT 检测机构" } },
  // This is a source marking graphic and query code, NOT a scanned 3C certificate.
  { name: "3C · BarryT i4 mark & verification QR", legacyName: "3C", issuer: null, certificateNo: null, image: "/company-profile/barryt-i4-3c-mark-qr.png", width: 1453, height: 581, expiresAt: null, sortOrder: 6, zh: { name: "3C 标识与查询码 · BarryT i4", issuer: "" } },
];

export const companyCertificationSection = {
  en: { title: "Certificates & Product Documents", subtitle: "Quality Documentation", content: "Explore our management-system documents and BarryT i4 product test and marking materials." },
  zh: { title: "认证资质与产品资料", subtitle: "品质文件", content: "展示管理体系证书及 BarryT i4 产品检测、认证标识资料。" },
};
