/** Verified against the user-supplied July 2026 company profile, not demo site metrics. */
export const companyProfileSource = {
  title: "山泽新能源公司简介(1).pdf",
  edition: "2026",
  companyName: "Dongguan Shanze New Energy Technology Co., Ltd.",
  companyNameZh: "东莞山泽新能源科技有限公司",
  technologySince: "1999",
  brandCommercialization: "2022",
  pages: { overview: 2, expertise: 3, history: 4, capabilities: 5, markets: 7, manufacturing: 14, global: 25, cooperation: 26 },
};

export const companyOverview = {
  en: "Shanze's battery expertise dates back to 1999. The company develops and manufactures lithium batteries, battery management systems and customized power solutions. Its Dongguan manufacturing base integrates cell selection, BMS design, mechanical engineering, assembly and reliability validation.",
  zh: "山泽新能源的技术积累始于 1999 年，长期专注于锂电池、电池管理系统及定制电源产品的研发与制造。公司以东莞制造基地为核心，形成从电芯选型、BMS 设计、结构开发、生产装配到可靠性验证的协同能力。",
};

type ProfileItem = { value?: string; title: string; text?: string; href?: string; label?: string };
type SectionCopy = { title: string; subtitle: string; content: string; items: ProfileItem[]; image?: string | null };
type ProfileSection = { page: string; key: string; sourcePages: number[]; en: SectionCopy; zh: SectionCopy };

export const companyProfileStats = {
  en: [
    { value: "1999", title: "Technical foundation" },
    { value: "27", title: "Years of expertise · 2026" },
    { value: "2022", title: "BarryT commercialization" },
    { value: "3", title: "Consumer, storage & drone markets" },
    { value: "Dongguan", title: "Manufacturing base" },
    { value: "BMS", title: "In-house design & thermal control" },
  ],
  zh: [
    { value: "1999", title: "电池技术积累起点" },
    { value: "27", title: "技术积累年数 · 截至 2026 年" },
    { value: "2022", title: "BarryT 品牌与产品商业化" },
    { value: "3", title: "消费电子、储能、低空动力市场" },
    { value: "东莞", title: "制造基地" },
    { value: "BMS", title: "自研电池管理与热管理" },
  ],
};

const history = {
  en: [
    { value: "1999", title: "Shenzhen foundation", text: "Battery technology and manufacturing expertise began in Shenzhen." },
    { value: "2003", title: "Systems development", text: "Standardized production lines and international certification supported the development of production systems." },
    { value: "2014", title: "Capability expansion", text: "Manufacturing facilities and R&D worked together to expand technical capabilities." },
    { value: "2022", title: "Dongguan launch", text: "Dongguan operations supported the commercialization of the BarryT brand and products." },
  ],
  zh: [
    { value: "1999", title: "深圳成立 · 技术起点", text: "开启电池技术与制造积累。" },
    { value: "2003", title: "体系建设", text: "标准化产线与国际认证，推进生产体系建设。" },
    { value: "2014", title: "能力扩展", text: "制造基地与研发协同，拓展技术能力。" },
    { value: "2022", title: "东莞落地", text: "BarryT 品牌与产品商业化。" },
  ],
};
const capabilities = {
  en: [
    { title: "Cell technology", text: "Semi-solid cell and materials technology." },
    { title: "Battery intelligence", text: "In-house BMS design and thermal control." },
    { title: "Manufacturing", text: "Automated manufacturing and quality traceability." },
  ],
  zh: [
    { title: "电芯技术", text: "半固态电芯与材料技术。" },
    { title: "智能保护", text: "自研 BMS 与热管理。" },
    { title: "智能制造", text: "自动化制造与质量追溯。" },
  ],
};
const globalPrinciples = {
  en: [
    { title: "Quality", text: "Consistent quality." },
    { title: "Customization", text: "Flexible engineering." },
    { title: "Response", text: "Responsive service." },
    { title: "Improvement", text: "Continuous improvement." },
  ],
  zh: [
    { title: "品质", text: "稳定品质。" },
    { title: "定制", text: "灵活定制。" },
    { title: "响应", text: "快速响应。" },
    { title: "改善", text: "持续改善。" },
  ],
};

export const companyProfileSections: ProfileSection[] = [
  {
    page: "about", key: "story", sourcePages: [2, 3, 4, 7],
    en: { title: "Our Story: From Technical Expertise to Brand Commercialization", subtitle: "Company History", content: `${companyOverview.en}\n\nThe 2026 company profile records 27 years of technical expertise. The journey spans a Shenzhen technology foundation, systems development and manufacturing/R&D expansion, followed by the BarryT brand's commercialization in Dongguan in 2022. Today, Shanze serves consumer electronics, energy storage and low-altitude mobility markets.`, image: "/company-profile/manufacturing-facility.jpg", items: history.en },
    zh: { title: "从技术积累到品牌与产品落地", subtitle: "公司发展历程", content: `${companyOverview.zh}\n\n2026 年公司简介记录了 27 年技术积累。从深圳技术起步、体系建设和制造研发协同，到 2022 年东莞落地及 BarryT 品牌与产品商业化，山泽持续服务消费电子、储能与低空动力市场。`, items: history.zh },
  },
  {
    page: "home", key: "about", sourcePages: [2, 5, 7],
    en: { title: "Battery Expertise. Built in Dongguan.", subtitle: "About Shanze", content: companyOverview.en, image: "/company-profile/manufacturing-collage.jpg", items: capabilities.en },
    zh: { title: "电池技术积累，东莞制造协同", subtitle: "关于山泽新能源科技", content: companyOverview.zh, items: capabilities.zh },
  },
  ...["home", "about", "factory"].map((page): ProfileSection => ({
    page, key: "stats", sourcePages: [2, 3, 4, 5, 7],
    en: { title: "Company Profile at a Glance", subtitle: "Verified Company Profile", content: "Technical heritage, manufacturing location and product directions recorded in the 2026 company profile. The 1999 date refers to technical foundations, not a verified incorporation date for the current legal entity.", items: companyProfileStats.en },
    zh: { title: "企业实力一览", subtitle: "公司简介数据", content: "根据 2026 年公司简介展示技术积累、制造基地与产品方向。1999 年为技术积累起点，不代表对现有法人主体登记成立日期的认定。", items: companyProfileStats.zh },
  })),
  {
    page: "about", key: "purpose", sourcePages: [5, 12],
    en: { title: "From Cell to System", subtitle: "Core Capabilities", content: "Core capabilities connect cells, BMS and intelligent manufacturing in one development and production workflow.", items: capabilities.en },
    zh: { title: "从电芯到系统，核心能力形成闭环", subtitle: "核心能力", content: "从电芯、BMS 到智能制造，形成研发与生产协同的核心能力。", items: capabilities.zh },
  },
  {
    page: "about", key: "partners", sourcePages: [25],
    en: { title: "Global Markets & Service", subtitle: "Built in Dongguan. Serving Globally.", content: "Supporting customers across regions and industries with consistent quality, flexible customization and responsive service.", image: "/company-profile/historical-market-references.jpg", items: [] },
    zh: { title: "全球市场与服务", subtitle: "立足东莞，服务全球", content: "以稳定品质、灵活定制和快速响应，服务不同地区与行业的客户。", items: [] },
  },
  {
    page: "about", key: "global", sourcePages: [7, 25, 26],
    en: { title: "Built in Dongguan. Serving Globally.", subtitle: "Global Markets", content: "Shanze serves customers across consumer electronics, energy storage and low-altitude mobility markets through quality, delivery and responsive service.\n\nCooperation follows requirement definition, cell/BMS/mechanical engineering, performance and compliance validation, and mass-production delivery with traceability.", image: "/company-profile/research-laboratory.jpg", items: globalPrinciples.en },
    zh: { title: "东莞制造，服务全球", subtitle: "全球市场", content: "山泽以品质、交付与响应能力服务不同地区和行业客户，业务覆盖消费电子、储能与低空动力市场。\n\n从需求与边界定义，到电芯、BMS、结构设计，再到性能与合规验证、量产交付和追溯，以透明、可验证的流程协同。", items: globalPrinciples.zh },
  },
  {
    page: "factory", key: "overview", sourcePages: [2, 5, 14, 16, 17],
    en: { title: "Dongguan Manufacturing: From Cell to System", subtitle: "Manufacturing Base", content: "Shanze's Dongguan manufacturing base connects cell selection, BMS design, mechanical engineering, assembly and reliability validation. Production management focuses on automation, traceability and batch consistency.", image: "/company-profile/manufacturing-collage.jpg", items: [
      { title: "R&D laboratory", text: "Materials, BMS development and reliability validation." },
      { title: "Manufacturing operations", text: "Controlled processes and coordinated production management." },
      { title: "Quality traceability", text: "Personnel, equipment and inspection checkpoints work together." },
      { title: "Final inspection", text: "Verification from material and process stages through shipment." },
    ] },
    zh: { title: "东莞制造基地：从电芯到系统", subtitle: "制造基地", content: "山泽以东莞制造基地为核心，协同电芯选型、BMS 设计、结构开发、生产装配与可靠性验证。生产管理围绕自动化、质量追溯与批次一致性展开。", items: [
      { title: "研发实验室", text: "材料实验、BMS 开发与可靠性验证。" },
      { title: "制造现场", text: "关键工序受控，生产管理协同。" },
      { title: "质量追溯", text: "人员、设备与检验节点协同管理。" },
      { title: "出货检测", text: "从材料、制程到出货，验证关键节点。" },
    ] },
  },
];

export const companyProfileSettings: Record<string, string> = {
  company_name: companyProfileSource.companyName,
  company_name_zh: companyProfileSource.companyNameZh,
  company_description: companyOverview.en,
  company_description_zh: companyOverview.zh,
  founded: "1999 · technical foundation",
  technology_since: "1999",
  brand_commercialization_year: "2022",
  manufacturing_city: "Dongguan",
  manufacturing_city_zh: "东莞",
  // The provided document contains no figures for these old bootstrap metrics.
  factory_area: "",
  monthly_output: "",
  export_countries: "",
};

export const companyAboutBanner = {
  en: { title: "About Shanze New Energy Technology", subtitle: "From Cell to System", description: "Battery expertise dating back to 1999, with a Dongguan manufacturing base serving consumer electronics, energy storage and low-altitude mobility markets.", image: "/company-profile/manufacturing-collage.jpg" },
  zh: { title: "关于山泽新能源科技", subtitle: "从电芯到系统", description: "电池技术积累始于 1999 年，以东莞制造基地为核心，服务消费电子、储能与低空动力市场。" },
};

export const companyAboutDocument = {
  en: { title: "About Shanze New Energy Technology", excerpt: "Battery expertise dating back to 1999. Built in Dongguan, serving consumer, storage and low-altitude mobility markets.", content: `${companyOverview.en}\n\n## Company History\n${history.en.map((item) => `### ${item.value}: ${item.title}\n${item.text}`).join("\n\n")}\n\n## Core Capabilities\n${capabilities.en.map((item) => `- ${item.title}: ${item.text}`).join("\n")}\n\n27 years of technical expertise is a figure stated in the 2026 company profile. The 1999 date describes technical heritage rather than verified incorporation of the current legal entity.` },
  zh: { title: "关于山泽新能源科技", excerpt: "技术积累始于 1999 年，立足东莞制造基地，服务消费电子、储能与低空动力市场。", content: `${companyOverview.zh}\n\n## 公司发展历程\n${history.zh.map((item) => `### ${item.value} 年：${item.title}\n${item.text}`).join("\n\n")}\n\n## 核心能力\n${capabilities.zh.map((item) => `- ${item.title}：${item.text}`).join("\n")}\n\n27 年技术积累为 2026 年公司简介所载数据；1999 年指技术积累起点，不代表现有法人主体的登记成立日期。` },
};
