export type CmsField = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "boolean" | "date" | "select" | "json" | "media" | "mediaGallery" | "visualMedia" | "visualGallery" | "file" | "email" | "password";
  required?: boolean;
  options?: { label: string; value: string }[];
  relation?: "categories" | "news-categories" | "admins" | "products" | "locales";
  help?: string;
  translatable?: boolean;
  jsonKind?: "keyValue" | "cards" | "faqs" | "contentItems";
  virtual?: boolean;
};

export type CmsSection = {
  key: string;
  label: string;
  singular: string;
  model: string;
  permission: string;
  description: string;
  fields: CmsField[];
  listFields: string[];
  readonly?: boolean;
};

const statusOptions = [
  { label: "草稿（前台不显示）", value: "DRAFT" },
  { label: "已发布（前台显示）", value: "PUBLISHED" },
  { label: "已归档", value: "ARCHIVED" },
];
const pageOptions = [["首页","home"],["关于我们","about"],["产品中心","products"],["工厂实力","factory"],["品质保障","quality"],["新闻资讯","news"],["联系我们","contact"]].map(([label,value])=>({label,value}));

export const cmsSections: CmsSection[] = [
  { key: "products", label: "产品管理", singular: "产品", model: "product", permission: "products", description: "产品资料、规格、特性、应用和发布状态", listFields: ["name", "sku", "status", "isFeatured", "updatedAt"], fields: [
    { key: "name", label: "产品名称", required: true, translatable: true }, { key: "slug", label: "URL Slug", required: true }, { key: "sku", label: "SKU", required: true },
    { key: "categoryId", label: "产品分类", type: "select", relation: "categories", required: true }, { key: "tagline", label: "副标题", translatable: true },
    { key: "summary", label: "产品摘要", type: "textarea", required: true, translatable: true }, { key: "description", label: "详细说明", type: "textarea", required: true, translatable: true },
    { key: "coverImage", label: "① 产品正面主图或视频（默认显示）", type: "visualMedia", help: "支持不同尺寸图片，前台会按原始比例自适应、居中完整显示；也可上传本地视频或使用视频链接。" }, { key: "hoverImage", label: "② 产品反面图片（鼠标悬停显示）", type: "media", help: "支持不同尺寸图片，前台会自适应完整显示。桌面端鼠标放到产品卡片时切换，移动端仍显示正面图。" }, { key: "galleryImages", label: "③ 产品详情图片与视频轮播", type: "visualGallery", virtual: true, help: "支持不同尺寸图片并自适应完整显示；可混合添加图片、本地视频和视频平台链接。" }, { key: "specifications", label: "产品规格", type: "json", jsonKind: "keyValue", required: true, translatable: true },
    { key: "features", label: "产品卖点", type: "json", jsonKind: "cards", required: true, translatable: true }, { key: "applications", label: "应用场景", type: "json", jsonKind: "cards", translatable: true }, { key: "faqs", label: "常见问题", type: "json", jsonKind: "faqs", translatable: true },
    { key: "isFeatured", label: "设为推荐", type: "boolean" }, { key: "sortOrder", label: "排序", type: "number" }, { key: "status", label: "状态", type: "select", options: statusOptions },
  ]},
  { key: "categories", label: "产品分类", singular: "分类", model: "productCategory", permission: "products", description: "前台产品分类与排序", listFields: ["name", "slug", "sortOrder", "isVisible"], fields: [
    { key: "name", label: "分类名称", required: true, translatable: true }, { key: "slug", label: "Slug", required: true }, { key: "description", label: "分类说明", type: "textarea", translatable: true },
    { key: "image", label: "分类图片（自适应完整显示）", type: "media", help: "支持不同宽高尺寸的 JPG、PNG 或 WebP 图片，前台会保持原始比例并居中显示。" }, { key: "icon", label: "图标名称" }, { key: "sortOrder", label: "排序", type: "number" }, { key: "isVisible", label: "前台显示", type: "boolean" },
  ]},
  { key: "downloads", label: "下载资料", singular: "下载资料", model: "productDownload", permission: "products", description: "产品规格书、认证文件和宣传资料", listFields: ["title", "fileType", "fileSize", "fileUrl"], fields: [
    { key: "productId", label: "关联产品", type: "select", relation: "products", required: true }, { key: "title", label: "资料名称", required: true, translatable: true }, { key: "fileUrl", label: "资料文件", type: "file", required: true }, { key: "fileType", label: "文件类型" }, { key: "fileSize", label: "显示大小" },
  ]},
  { key: "news", label: "新闻管理", singular: "新闻", model: "news", permission: "news", description: "新闻、洞察、展会和公司动态", listFields: ["title", "status", "isFeatured", "publishedAt"], fields: [
    { key: "title", label: "标题", required: true, translatable: true }, { key: "slug", label: "Slug", required: true }, { key: "categoryId", label: "新闻分类", type: "select", relation: "news-categories", required: true },
    { key: "excerpt", label: "摘要", type: "textarea", required: true, translatable: true }, { key: "content", label: "正文", type: "textarea", required: true, translatable: true }, { key: "coverImage", label: "新闻封面图片", type: "media" },
    { key: "author", label: "作者" }, { key: "isFeatured", label: "设为头条", type: "boolean" }, { key: "status", label: "状态", type: "select", options: statusOptions }, { key: "publishedAt", label: "发布时间", type: "date" },
  ]},
  { key: "news-categories", label: "新闻分类", singular: "新闻分类", model: "newsCategory", permission: "news", description: "新闻栏目与排序", listFields: ["name", "slug", "sortOrder"], fields: [
    { key: "name", label: "名称", required: true, translatable: true }, { key: "slug", label: "Slug", required: true }, { key: "sortOrder", label: "排序", type: "number" },
  ]},
  { key: "pages", label: "独立页面与政策", singular: "页面", model: "page", permission: "pages", description: "编辑隐私政策、使用条款及其他可发布的独立页面，中英文均可维护", listFields: ["title", "slug", "status", "updatedAt"], fields: [
    { key: "title", label: "页面标题", required: true, translatable: true }, { key: "slug", label: "Slug", required: true }, { key: "excerpt", label: "摘要", type: "textarea", translatable: true }, { key: "content", label: "内容", type: "textarea", required: true, translatable: true },
    { key: "template", label: "模板" }, { key: "status", label: "状态", type: "select", options: statusOptions }, { key: "publishedAt", label: "发布时间", type: "date" },
  ]},
  { key: "page-sections", label: "页面区块", singular: "页面区块", model: "pageSection", permission: "pages", description: "逐区块修改前台标题、说明、背景图和按钮，无需编辑代码", listFields: ["page", "title", "key", "isVisible", "updatedAt"], fields: [
    { key: "page", label: "所属页面", type: "select", required: true, options: pageOptions }, { key: "key", label: "内容位置标识", required: true, help: "用于识别前台位置，创建后不建议修改" },
    { key: "title", label: "区块标题", required: true, translatable: true }, { key: "subtitle", label: "小标题", translatable: true }, { key: "content", label: "区块说明", type: "textarea", translatable: true }, { key: "image", label: "区块背景 / 配图", type: "media" },
    { key: "items", label: "区块内的列表、数字或卡片", type: "json", jsonKind: "contentItems", translatable: true, help: "每一项都可修改标题、说明、数字、图片和链接；不用接触代码。" },
    { key: "buttonLabel", label: "按钮文字", translatable: true }, { key: "buttonHref", label: "按钮链接" }, { key: "sortOrder", label: "显示顺序", type: "number" }, { key: "isVisible", label: "前台显示", type: "boolean" },
  ]},
  { key: "equipment", label: "工厂设备", singular: "设备", model: "factoryEquipment", permission: "factory", description: "生产设备、能力和数据", listFields: ["name", "metric", "sortOrder", "isVisible"], fields: [
    { key: "name", label: "设备名称", required: true, translatable: true }, { key: "description", label: "说明", type: "textarea", required: true, translatable: true }, { key: "image", label: "设备完整图片（不裁切）", type: "media", help: "前台会保持图片原始比例并完整显示，不会拉伸或裁掉设备主体。推荐横图 1600×900 或 1200×675。" }, { key: "metric", label: "能力指标", translatable: true }, { key: "sortOrder", label: "排序", type: "number" }, { key: "isVisible", label: "显示", type: "boolean" },
  ]},
  { key: "workshops", label: "车间环境六项", singular: "车间项目", model: "workshop", permission: "factory", description: "逐项修改生产线、标准着装员工、质检区、包装区、仓库和物流装运区的名称、说明及图片", listFields: ["image", "name", "sortOrder", "isVisible", "updatedAt"], fields: [
    { key: "name", label: "前台显示名称", required: true, translatable: true }, { key: "description", label: "图片下方说明", type: "textarea", translatable: true }, { key: "image", label: "该项目的车间图片", type: "media", help: "推荐横向图片 1600×900 或 1200×675；保存后工厂实力和品质保障页面会立即使用。" }, { key: "sortOrder", label: "显示顺序", type: "number" }, { key: "isVisible", label: "前台显示", type: "boolean" },
  ]},
  { key: "certificates", label: "认证资质与证书照片", singular: "证书", model: "certificate", permission: "quality", description: "逐张上传完整证书照片、填写认证资料并控制前台展示", listFields: ["image", "name", "issuer", "certificateNo", "isVisible"], fields: [
    { key: "name", label: "认证名称", required: true, translatable: true }, { key: "issuer", label: "签发机构", translatable: true }, { key: "certificateNo", label: "证书编号" }, { key: "image", label: "完整证书照片", type: "media", help: "请上传完整、清晰、四周不裁切的证书照片；推荐竖版 1200×1697（A4 比例），PNG、JPG 或 WebP。" }, { key: "fileUrl", label: "可下载的证书原文件（可选）", type: "file", help: "可上传 PDF 原件，客户点击前台证书时可查看或下载。" }, { key: "expiresAt", label: "到期日", type: "date" }, { key: "sortOrder", label: "显示顺序", type: "number" }, { key: "isVisible", label: "前台显示", type: "boolean" },
  ]},
  { key: "banners", label: "各页面首屏轮播", singular: "轮播内容", model: "banner", permission: "pages", description: "首页、关于我们、产品中心、工厂实力、品质保障、新闻资讯和联系我们均可添加多张背景图片或视频组成轮播", listFields: ["title", "page", "status", "sortOrder"], fields: [
      { key: "key", label: "系统识别编号", required: true, help: "新增时由系统自动生成，编辑时无需修改" }, { key: "page", label: "显示在哪个页面", type: "select", required: true, options: pageOptions }, { key: "title", label: "主标题", required: true, translatable: true }, { key: "subtitle", label: "蓝色强调标题", translatable: true }, { key: "description", label: "标题下方说明", type: "textarea", translatable: true }, { key: "image", label: "本张轮播的背景图片或视频", type: "visualMedia", help: "可本地上传图片、MP4/WebM 视频，或粘贴 YouTube、Vimeo、Bilibili、Youku 视频链接。同一页面发布多条后每 2 秒自动切换。" }, { key: "ctaLabel", label: "按钮显示文字", translatable: true }, { key: "ctaHref", label: "按钮点击后跳转地址" }, { key: "sortOrder", label: "轮播顺序", type: "number" }, { key: "status", label: "前台显示状态", type: "select", options: statusOptions },
  ]},
  { key: "seo", label: "SEO 管理", singular: "SEO", model: "seoMeta", permission: "seo", description: "Meta、Canonical、Open Graph 与结构化数据", listFields: ["route", "title", "noIndex", "updatedAt"], fields: [
    { key: "route", label: "路由", required: true }, { key: "title", label: "SEO 标题", required: true, translatable: true }, { key: "description", label: "Meta 描述", type: "textarea", required: true, translatable: true }, { key: "keywords", label: "关键词", translatable: true }, { key: "canonical", label: "Canonical" }, { key: "ogImage", label: "Open Graph 图片", type: "media" }, { key: "noIndex", label: "禁止索引", type: "boolean" }, { key: "schemaJson", label: "Schema JSON-LD", type: "json" },
  ]},
  { key: "navigation", label: "导航管理", singular: "导航项", model: "navigationItem", permission: "pages", description: "页头、页脚导航和排序", listFields: ["label", "href", "location", "sortOrder", "isVisible"], fields: [
    { key: "label", label: "显示名称", required: true, translatable: true }, { key: "href", label: "链接", required: true }, { key: "location", label: "位置", type: "select", options: ["HEADER", "FOOTER", "PRODUCTS"].map((value) => ({ label: value, value })) }, { key: "sortOrder", label: "排序", type: "number" }, { key: "isVisible", label: "显示", type: "boolean" },
  ]},
  { key: "settings", label: "站点设置", singular: "设置", model: "setting", permission: "settings", description: "联系方式、品牌资料和全局开关", listFields: ["group", "key", "value", "isPublic"], fields: [
    { key: "group", label: "分组", required: true }, { key: "key", label: "键", required: true }, { key: "value", label: "值", type: "textarea", required: true }, { key: "type", label: "类型" }, { key: "isPublic", label: "公开配置", type: "boolean" },
  ]},
  { key: "locales", label: "多语言", singular: "语言", model: "locale", permission: "locales", description: "语言启用状态和默认语言", listFields: ["code", "name", "isDefault", "isActive"], fields: [
    { key: "code", label: "语言代码", required: true }, { key: "name", label: "语言名称", required: true }, { key: "isDefault", label: "默认语言", type: "boolean" }, { key: "isActive", label: "启用", type: "boolean" }, { key: "sortOrder", label: "排序", type: "number" },
  ]},
  { key: "translations", label: "翻译内容", singular: "翻译", model: "translation", permission: "locales", description: "实体字段级多语言翻译", listFields: ["entityType", "entityId", "field", "value"], fields: [
    { key: "localeId", label: "目标语言", type: "select", relation: "locales", required: true }, { key: "entityType", label: "实体类型", required: true }, { key: "entityId", label: "实体 ID", required: true }, { key: "field", label: "字段", required: true }, { key: "value", label: "翻译内容", type: "textarea", required: true },
  ]},
  { key: "inquiries", label: "询盘 CRM", singular: "询盘", model: "inquiry", permission: "inquiries", description: "客户询盘、销售分配和跟进状态", listFields: ["referenceNo", "companyName", "fullName", "status", "priority", "createdAt"], fields: [
    { key: "fullName", label: "联系人", required: true }, { key: "companyName", label: "公司", required: true }, { key: "email", label: "邮箱", type: "email", required: true }, { key: "phone", label: "电话" }, { key: "country", label: "国家", required: true }, { key: "productInterest", label: "产品兴趣", required: true }, { key: "message", label: "需求", type: "textarea", required: true },
    { key: "status", label: "销售阶段", type: "select", options: ["NEW", "ASSIGNED", "CONTACTED", "QUALIFIED", "QUOTED", "WON", "LOST", "SPAM"].map((value) => ({ label: value, value })) }, { key: "priority", label: "优先级", type: "select", options: ["low", "normal", "high", "urgent"].map((value) => ({ label: value, value })) }, { key: "assignedToId", label: "负责人", type: "select", relation: "admins" }, { key: "nextFollowUpAt", label: "下次跟进", type: "date" },
  ]},
  { key: "newsletter-subscribers", label: "订阅用户管理", singular: "订阅用户", model: "newsletterSubscriber", permission: "email", description: "管理前台提交的订阅邮箱、语言和接收状态", listFields: ["email", "locale", "isActive", "source", "consentAt", "unsubscribedAt"], fields: [
    { key: "email", label: "订阅邮箱", type: "email", required: true },
    { key: "locale", label: "接收语言", type: "select", options: [{ label: "中文", value: "zh" }, { label: "English", value: "en" }], required: true },
    { key: "source", label: "订阅来源", type: "select", options: [{ label: "官网订阅", value: "website" }, { label: "后台添加", value: "admin" }, { label: "数据导入", value: "import" }], required: true },
    { key: "isActive", label: "接收订阅邮件", type: "boolean", help: "关闭后不会再收到新闻或新品通知，再次启用即可恢复。" },
  ]},
  { key: "email-templates", label: "邮件内容模板", singular: "模板", model: "emailTemplate", permission: "email", description: "用普通文字或 HTML 自定义新闻、新品和询盘通知邮件；保留系统默认模板即可直接使用", listFields: ["key", "name", "subject", "isActive"], fields: [
    { key: "key", label: "模板标识（请勿随意修改）", required: true, help: "系统根据该标识选择中英文新闻或新品模板。" }, { key: "name", label: "后台显示名称", required: true }, { key: "subject", label: "邮件标题", required: true, help: "可使用变量：{{title}}、{{companyName}}" }, { key: "html", label: "邮件正文", type: "textarea", required: true, help: "可直接输入普通文字，也支持 HTML。可用变量：{{title}}、{{summary}}、{{url}}、{{companyName}}、{{unsubscribeUrl}}" }, { key: "text", label: "纯文本备用正文", type: "textarea", help: "收件人的邮箱不支持 HTML 时显示。" }, { key: "isActive", label: "启用自动发送", type: "boolean" },
  ]},
  { key: "email-queue", label: "邮件队列", singular: "邮件", model: "emailQueue", permission: "email", description: "发送状态、失败原因与重试计划", listFields: ["to", "subject", "status", "attempts", "nextAttemptAt"], fields: [], readonly: true },
  { key: "website-visits", label: "网站访问记录", singular: "访问记录", model: "websiteVisit", permission: "security", description: "按年月日查看真实访问页面、来源 IP、国家、地区、城市和设备；仅保留最近 3 个月", listFields: ["ip", "country", "region", "city", "path", "referrer", "device", "createdAt"], fields: [
    { key: "ip", label: "来源 IP" },
    { key: "country", label: "国家" },
    { key: "region", label: "省 / 州 / 地区" },
    { key: "city", label: "城市" },
    { key: "path", label: "访问页面" },
    { key: "referrer", label: "来源网址" },
    { key: "device", label: "设备" },
    { key: "createdAt", label: "访问时间", type: "date" },
  ], readonly: true },
  { key: "audit", label: "操作审计", singular: "日志", model: "auditLog", permission: "security", description: "显示操作人、中文动作和具体对象；按年月日折叠归档，仅保留最近 3 个月", listFields: ["actor", "actionLabel", "entityLabel", "targetLabel", "ip", "createdAt"], fields: [
    { key: "actor", label: "操作人", virtual: true },
    { key: "actionLabel", label: "执行动作", virtual: true },
    { key: "entityLabel", label: "操作对象", virtual: true },
    { key: "targetLabel", label: "具体内容", virtual: true },
  ], readonly: true },
  { key: "login-logs", label: "登录日志", singular: "登录日志", model: "loginLog", permission: "security", description: "成功与失败登录事件", listFields: ["email", "success", "reason", "ip", "createdAt"], fields: [], readonly: true },
    { key: "trash", label: "回收站", singular: "回收项", model: "trashItem", permission: "settings", description: "删除内容的可恢复快照", listFields: ["displayName", "entityType", "deletedSummary", "deletedBy", "deletedAt"], fields: [], readonly: true },
  { key: "backups", label: "数据备份", singular: "备份", model: "backupRecord", permission: "settings", description: "可创建、下载、重新上传并恢复 SQLite 数据库；导入文件会先完成格式、来源和完整性校验", listFields: ["fileName", "size", "status", "createdAt"], fields: [], readonly: true },
  { key: "media", label: "媒体文件", singular: "媒体", model: "media", permission: "media", description: "安全上传的图片与资料文件", listFields: ["name", "mimeType", "size", "folder", "createdAt"], fields: [], readonly: true },
];

export function getCmsSection(key: string) {
  return cmsSections.find((section) => section.key === key);
}

export function translationEntityType(model: string) {
  return model.charAt(0).toUpperCase() + model.slice(1);
}

export function coerceCmsData(section: CmsSection, input: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  for (const field of section.fields) {
    if (field.virtual) continue;
    if (!(field.key in input)) continue;
    const value = input[field.key];
    if (field.type === "number") output[field.key] = Number(value || 0);
    else if (field.type === "boolean") output[field.key] = value === true || value === "true" || value === "on";
    else if (field.type === "date") output[field.key] = value ? new Date(String(value)) : null;
    else if (field.type === "json") {
      const parsed = typeof value === "string" ? JSON.parse(value || "{}") : value;
      output[field.key] = JSON.stringify(parsed);
    } else output[field.key] = typeof value === "string" ? value.trim() : value;
  }
  if (section.key === "products" || section.key === "news" || section.key === "pages") {
    if (output.status === "PUBLISHED" && !output.publishedAt) output.publishedAt = new Date();
  }
  return output;
}
