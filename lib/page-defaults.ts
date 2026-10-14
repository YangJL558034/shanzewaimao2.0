import { companyProfileSections } from "@/lib/company-profile";
import { companyCertificationSection } from "@/lib/company-certificates";
const items = (value: Array<Record<string, string>>) => JSON.stringify(value);

const initialPageSections = [
  { page: "home", key: "products", title: "Our Products", subtitle: "Product Categories", content: "High-quality charging products designed for modern life and global B2B programs.", image: null, buttonLabel: "View More", buttonHref: "/products", items: "[]", sortOrder: 3 },
  { page: "home", key: "equipment", title: "Advanced Production Equipment", subtitle: "Manufacturing Capability", content: "Modern machines ensure high efficiency and stable quality.", image: "/references/factory.png", buttonLabel: "View Factory", buttonHref: "/factory", items: "[]", sortOrder: 4 },
  { page: "home", key: "workshop", title: "Clean & Organized Workshop Environment", subtitle: "Workshop Environment", content: "Standardized production spaces support consistent quality.", image: "/references/quality.png", buttonLabel: "View Quality", buttonHref: "/quality", items: "[]", sortOrder: 5 },
  { page: "home", key: "quality", title: "Quality Built Into Every Step", subtitle: "Quality & Certifications", content: "Incoming inspection, in-process monitoring, final performance tests and shipment verification create consistent outcomes.", image: null, buttonLabel: "Quality System", buttonHref: "/quality", items: items([{ title: "Strict Quality Control", text: "IQC, IPQC, FQC and OQC checks." }, { title: "Multiple Certifications", text: "CE, FCC, RoHS and transport compliance." }, { title: "Reliable Materials", text: "Qualified and fully traceable components." }, { title: "Global Export Service", text: "Fast, professional delivery support." }, { title: "OEM/ODM", text: "End-to-end customization for your brand." }]), sortOrder: 6 },


  { page: "products", key: "categories", title: "Product Categories", subtitle: "Browse by Category", content: "Choose a category to explore charging solutions for your market.", image: null, buttonLabel: "View More", buttonHref: "/products", items: "[]", sortOrder: 1 },
  { page: "products", key: "featured", title: "Featured Products", subtitle: "Selected Solutions", content: "Carefully selected solutions for global buyers.", image: null, buttonLabel: "View Details", buttonHref: null, items: "[]", sortOrder: 2 },
  { page: "products", key: "applications", title: "Built for Every Application", subtitle: "Applications", content: "Products designed for consumer, business, travel and promotional programs.", image: null, buttonLabel: null, buttonHref: null, items: items([{ title: "Smartphones & Tablets" }, { title: "Wearables & Earbuds" }, { title: "Business & Office" }, { title: "Travel & Mobility" }, { title: "Retail & Promotions" }, { title: "Home & Lifestyle" }]), sortOrder: 3 },
  { page: "products", key: "customization", title: "From Product Idea to Market-Ready", subtitle: "OEM/ODM Customization", content: "Product and ID design, private label, packaging customization and compliance support in one dependable program.", image: "/references/products.png", buttonLabel: "Start a Custom Project", buttonHref: "/contact", items: "[]", sortOrder: 4 },
  { page: "products", key: "catalog", title: "Download Product Catalog", subtitle: "Product Files", content: "Explore our product range, specifications and certifications.", image: "/references/products.png", buttonLabel: "Download Catalog", buttonHref: "/api/downloads/catalog", items: "[]", sortOrder: 5 },

  { page: "factory", key: "equipment", title: "Advanced Equipment. Superior Quality.", subtitle: "Equipment & Machinery", content: "From precision machining to final testing, our systems deliver to the highest standards.", image: null, buttonLabel: null, buttonHref: null, items: "[]", sortOrder: 3 },
  { page: "factory", key: "process", title: "Systematic Process. Reliable Output.", subtitle: "Production Process", content: "Every stage is controlled and traceable.", image: null, buttonLabel: null, buttonHref: null, items: items([{ title: "R&D & Design", text: "Product innovation" }, { title: "Material Incoming", text: "IQC inspection" }, { title: "SMT Processing", text: "Precision placement" }, { title: "Assembly", text: "Functional assembly" }, { title: "Testing", text: "ICT, FCT and aging" }, { title: "Delivery", text: "Global shipping" }]), sortOrder: 4 },
  { page: "factory", key: "workshop", title: "Clean, Organized and Efficient", subtitle: "Workshop Environment", content: "Standardized production spaces support efficient and consistent output.", image: null, buttonLabel: null, buttonHref: null, items: "[]", sortOrder: 5 },

  { page: "quality", key: "control", title: "Quality Control System", subtitle: "Documented Process", content: "Every critical checkpoint is documented, measurable and traceable.", image: null, buttonLabel: null, buttonHref: null, items: items([{ value: "IQC", title: "Incoming Quality Control", text: "Raw material inspection and supplier evaluation" }, { value: "IPQC", title: "In-Process Quality Control", text: "Process verification and quality records" }, { value: "FQC / IPQA", title: "Final Inspection", text: "Performance verification and quality assurance" }, { value: "OQC", title: "Outgoing Quality Control", text: "Shipment inspection and release" }, { value: "Feedback", title: "Continuous Improvement", text: "Data-driven corrective and preventive action" }]), sortOrder: 1 },
  { page: "quality", key: "lab", title: "Test Lab & Reliability Testing", subtitle: "Reliability Verification", content: "Professional equipment and engineers ensure safety, durability and compliance.", image: "/references/quality.png", buttonLabel: null, buttonHref: null, items: items([{ title: "High & Low Temperature", text: "Documented safety and reliability testing" }, { title: "Temperature Cycling", text: "Documented safety and reliability testing" }, { title: "Drop Test", text: "Documented safety and reliability testing" }, { title: "Salt Spray Test", text: "Documented safety and reliability testing" }, { title: "Aging Test", text: "Documented safety and reliability testing" }, { title: "Electrical Performance", text: "Documented safety and reliability testing" }]), sortOrder: 2 },
  { page: "quality", key: "certifications", ...companyCertificationSection.en, image: null, buttonLabel: null, buttonHref: null, items: "[]", sortOrder: 3 },
  { page: "quality", key: "workshop", title: "Workshop Environment", subtitle: "Clean Production", content: "Clean, organized and efficient production ensures superior quality.", image: "/references/quality.png", buttonLabel: null, buttonHref: null, items: "[]", sortOrder: 4 },
  { page: "quality", key: "traceability", title: "Built on Qualified Materials and Full Traceability", subtitle: "Material & Traceability", content: "Every key material, process and test record supports consistent quality.", image: null, buttonLabel: null, buttonHref: null, items: items([{ title: "Qualified Suppliers", text: "Approved material sources and ongoing supplier performance reviews." }, { title: "Unique Product ID", text: "Each production unit and lot can be traced through critical records." }, { title: "Full Test Records", text: "Production and reliability data retained for quality assurance." }, { title: "Batch Management", text: "Material, process, test and shipment records linked by batch." }, { title: "Customer Audit Support", text: "Transparent documentation for buyer and third-party reviews." }]), sortOrder: 5 },

  { page: "news", key: "listing", title: "Latest News & Insights", subtitle: "News Center", content: "Browse product launches, company updates, factory news, trade shows and industry insights.", image: null, buttonLabel: "Read More", buttonHref: null, items: "[]", sortOrder: 1 },
  { page: "news", key: "newsletter", title: "Subscribe to Our Newsletter", subtitle: "Email Updates", content: "Get the latest news and product insights straight to your inbox.", image: null, buttonLabel: "Subscribe", buttonHref: null, items: "[]", sortOrder: 2 },

  { page: "contact", key: "form", title: "Send Us a Message / Get a Quote", subtitle: "Project Inquiry", content: "Tell us about your requirements and our team will contact you shortly.", image: null, buttonLabel: "Send Inquiry", buttonHref: null, items: "[]", sortOrder: 1 },
  { page: "contact", key: "information", title: "Contact Information", subtitle: "Talk to Our Team", content: "Our sales team supports global B2B projects.", image: null, buttonLabel: null, buttonHref: null, items: items([{ title: "Phone / WhatsApp", text: "Mon–Sat, 8:30 AM–6:00 PM", value: "+86 755 8888 9999" }, { title: "Email Us", text: "We reply within 24 hours", value: "sales@shanzesz.com" }, { title: "Office Address", text: "Building A, No.168 Industrial Road, Shenzhen, Guangdong, China", value: "Shanze New Energy Technology Co., Ltd." }, { title: "Business Hours", text: "Monday–Friday: 8:30 AM–6:00 PM\nSaturday: 8:30 AM–12:00 PM\nSunday & Public Holiday: Closed" }]), sortOrder: 2 },
] as const;

const profileOrder: Record<string, number> = { "home:about": 1, "home:stats": 2, "about:story": 1, "about:stats": 2, "about:purpose": 3, "about:partners": 4, "about:global": 5, "factory:overview": 1, "factory:stats": 2 };
const profileButtons: Record<string, [string, string]> = { "home:about": ["Learn More", "/about"], "about:story": ["View Our Factory", "/factory"], "about:global": ["Become Our Partner", "/contact"] };
export const defaultPageSections = [
  ...initialPageSections,
  ...companyProfileSections.map((profile) => ({
    page: profile.page, key: profile.key, ...profile.en,
    items: JSON.stringify(profile.en.items), image: profile.en.image || null,
    buttonLabel: profileButtons[`${profile.page}:${profile.key}`]?.[0] || null,
    buttonHref: profileButtons[`${profile.page}:${profile.key}`]?.[1] || null,
    sortOrder: profileOrder[`${profile.page}:${profile.key}`],
  })),
];

const initialPageSectionZh: Record<string, Record<string, string>> = {
  "home:products": { title: "我们的产品", subtitle: "产品分类", content: "面向现代生活和全球 B2B 项目的高品质充电产品。", buttonLabel: "查看更多" },
  "home:equipment": { title: "先进生产设备", subtitle: "制造能力", content: "现代化设备确保高效率和稳定品质。", buttonLabel: "查看工厂" },
  "home:workshop": { title: "整洁有序的车间环境", subtitle: "车间环境", content: "标准化生产空间保障持续稳定的品质。", buttonLabel: "查看品质" },
  "home:quality": { title: "品质融入每一个环节", subtitle: "品质与认证", content: "来料检验、过程监控、最终性能测试和出货验证，确保持续稳定的结果。", items: items([{ title: "严格质量控制", text: "IQC、IPQC、FQC 和 OQC 全流程检查。" }, { title: "多项国际认证", text: "CE、FCC、RoHS 和运输合规。" }, { title: "可靠材料", text: "合格且全程可追溯的零部件。" }, { title: "全球出口服务", text: "快速、专业的交付支持。" }, { title: "OEM/ODM", text: "面向品牌的一站式定制。" }]) },
  "products:categories": { title: "产品分类", subtitle: "按分类浏览", content: "选择分类，查找适合您市场的充电解决方案。", buttonLabel: "查看更多" },
  "products:featured": { title: "精选产品", subtitle: "精选方案", content: "为全球采购商精心挑选的可靠解决方案。", buttonLabel: "查看详情" },
  "products:applications": { title: "适用于多种场景", subtitle: "应用场景", content: "面向消费、商务、旅行和促销项目。", items: items([{ title: "手机与平板" }, { title: "穿戴与耳机" }, { title: "商务办公" }, { title: "旅行出行" }, { title: "零售礼赠" }, { title: "家居生活" }]) },
  "products:customization": { title: "从产品创意到市场落地", subtitle: "OEM/ODM 定制", content: "产品与外观设计、私人标签、包装定制和合规支持，一站式可靠交付。", buttonLabel: "启动定制项目" },
  "products:catalog": { title: "下载产品目录", subtitle: "产品资料", content: "浏览产品范围、规格和认证。", buttonLabel: "下载产品目录" },
  "factory:equipment": { title: "先进设备，卓越品质", subtitle: "设备与机械", content: "从精密加工到最终测试，系统按照高标准运行。" },
  "factory:process": { title: "系统流程，可靠产出", subtitle: "生产流程", content: "每个阶段都受控且可追溯。", items: items([{ title: "研发与设计", text: "产品创新" }, { title: "材料来料", text: "IQC 检验" }, { title: "SMT 加工", text: "精密贴装" }, { title: "装配", text: "功能装配" }, { title: "测试", text: "ICT、FCT 与老化" }, { title: "交付", text: "全球运输" }]) },
  "factory:workshop": { title: "整洁、有序、高效", subtitle: "车间环境", content: "标准化生产空间支持高效稳定的产出。" },
  "quality:control": { title: "质量控制体系", subtitle: "记录化流程", content: "每个关键质量节点都有记录、可量化、可追溯。", items: items([{ value: "IQC", title: "来料质量控制", text: "原材料检验与供应商评估" }, { value: "IPQC", title: "制程质量控制", text: "过程验证与质量记录" }, { value: "FQC / IPQA", title: "成品检验与质量保证", text: "性能验证和质量保证" }, { value: "OQC", title: "出货质量控制", text: "出货检验与放行" }, { value: "反馈改进", title: "持续改进", text: "数据驱动的纠正与预防措施" }]) },
  "quality:lab": { title: "实验室与可靠性测试", subtitle: "可靠性验证", content: "专业设备与工程团队确保产品安全、耐用并符合标准。", items: items([{ title: "高低温测试", text: "标准化安全与可靠性测试记录" }, { title: "温度循环测试", text: "标准化安全与可靠性测试记录" }, { title: "跌落测试", text: "标准化安全与可靠性测试记录" }, { title: "盐雾测试", text: "标准化安全与可靠性测试记录" }, { title: "老化测试", text: "标准化安全与可靠性测试记录" }, { title: "电性能测试", text: "标准化安全与可靠性测试记录" }]) },
  "quality:certifications": companyCertificationSection.zh,
  "quality:workshop": { title: "车间环境", subtitle: "洁净生产", content: "整洁、有序、高效的生产环境保障稳定品质。" },
  "quality:traceability": { title: "优质材料与全程追溯", subtitle: "材料与追溯", content: "关键材料、工艺和测试记录支撑稳定品质。", items: items([{ title: "合格供应商", text: "批准的材料来源和持续供应商绩效审核。" }, { title: "唯一产品标识", text: "每个生产单元和批次均可追溯关键记录。" }, { title: "完整测试记录", text: "保存生产和可靠性数据用于质量保证。" }, { title: "批次管理", text: "材料、制程、测试和发货记录按批次关联。" }, { title: "客户审核支持", text: "为客户和第三方审核提供透明文件。" }]) },
  "news:listing": { title: "最新新闻与洞察", subtitle: "新闻中心", content: "浏览产品发布、公司动态、工厂新闻、展会和行业洞察。", buttonLabel: "阅读全文" },
  "news:newsletter": { title: "订阅我们的资讯", subtitle: "邮件更新", content: "将最新新闻和产品洞察发送到您的邮箱。", buttonLabel: "订阅" },
  "contact:form": { title: "发送消息 / 获取报价", subtitle: "项目询盘", content: "请告诉我们您的需求，团队将尽快联系您。", buttonLabel: "发送询盘" },
  "contact:information": { title: "联系信息", subtitle: "联系我们的团队", content: "销售团队为全球 B2B 项目提供支持。", items: items([{ title: "电话 / WhatsApp", text: "周一至周六，8:30–18:00", value: "+86 755 8888 9999" }, { title: "电子邮箱", text: "24 小时内回复", value: "sales@shanzesz.com" }, { title: "办公地址", text: "中国广东省深圳市工业路168号A栋", value: "山泽新能源科技" }, { title: "工作时间", text: "周一至周五：8:30–18:00\n周六：8:30–12:00\n周日及法定节假日：休息" }]) },
};

const profileButtonZh: Record<string, { buttonLabel: string }> = { "home:about": { buttonLabel: "了解更多" }, "about:story": { buttonLabel: "查看我们的工厂" }, "about:global": { buttonLabel: "成为合作伙伴" } };
export const defaultPageSectionZh: Record<string, Record<string, string>> = {
  ...initialPageSectionZh,
  ...Object.fromEntries(companyProfileSections.map((profile) => [`${profile.page}:${profile.key}`, { title: profile.zh.title, subtitle: profile.zh.subtitle, content: profile.zh.content, items: JSON.stringify(profile.zh.items), ...(profileButtonZh[`${profile.page}:${profile.key}`] || {}) }])),
};
