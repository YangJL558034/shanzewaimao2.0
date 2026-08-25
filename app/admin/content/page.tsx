import Link from "next/link";
import { Boxes, Building2, Factory, FileText, Globe2, Image as ImageIcon, Mail, Newspaper, PanelsTopLeft, Settings } from "lucide-react";
import { AdminManager } from "@/components/admin/AdminManager";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const pages = [
  { key: "home", label: "首页", href: "/", help: "首页全部区块" },
  { key: "about", label: "关于我们", href: "/about", help: "故事、数据与价值观" },
  { key: "products", label: "产品中心", href: "/products", help: "分类、产品与定制区" },
  { key: "factory", label: "工厂实力", href: "/factory", help: "概览、设备与流程" },
  { key: "quality", label: "品质保障", href: "/quality", help: "质控、实验室与认证" },
  { key: "news", label: "新闻资讯", href: "/news", help: "新闻列表与订阅区" },
  { key: "contact", label: "联系我们", href: "/contact", help: "联系资料与询盘区" },
  { key: "global", label: "全站页头与页脚", href: "/", help: "Logo、公司名、菜单和底部" },
] as const;

const related: Record<string, Array<{ title: string; description: string; href: string }>> = {
  home: [
    { title: "产品分类卡片", description: "修改首页产品图片和说明", href: "/admin/categories" },
    { title: "生产设备卡片", description: "修改设备名称、说明和图片", href: "/admin/equipment" },
    { title: "车间环境卡片", description: "修改车间图片和说明", href: "/admin/workshops" },
    { title: "认证资质", description: "修改证书名称、图片和文件", href: "/admin/certificates" },
  ],
  about: [
    { title: "合作伙伴公司", description: "添加公司名称、合作类型、官网链接和本地 Logo 图片", href: "/admin/content?page=about#page-section-partners" },
    { title: "公司名称与 Logo", description: "修改页头、页脚和公司公共资料", href: "/admin/settings" },
  ],
  products: [
    { title: "产品分类", description: "分类图片、名称和排序", href: "/admin/categories" },
    { title: "产品列表与详情", description: "产品文字、封面和详情轮播图", href: "/admin/products" },
    { title: "下载资料", description: "目录、规格书和认证文件", href: "/admin/downloads" },
  ],
  factory: [
    { title: "工厂设备", description: "设备卡片、图片和说明", href: "/admin/equipment" },
    { title: "车间环境六项", description: "逐项修改产线、员工、质检、包装、仓库和装运图片", href: "/admin/workshops" },
  ],
  quality: [
    { title: "认证资质", description: "证书图片、名称和文件", href: "/admin/certificates" },
    { title: "车间环境", description: "品质页面使用的车间图片", href: "/admin/workshops" },
  ],
  news: [
    { title: "新闻文章", description: "发布新闻并自动通知订阅用户", href: "/admin/news" },
    { title: "新闻分类", description: "修改分类名称和排序", href: "/admin/news-categories" },
    { title: "订阅用户", description: "查看前台提交的邮箱和接收状态", href: "/admin/newsletter-subscribers" },
    { title: "订阅邮件内容", description: "设计新品和新闻通知邮件", href: "/admin/email-templates" },
  ],
  contact: [
    { title: "询盘 CRM", description: "查看客户留言、分配和跟进", href: "/admin/inquiries" },
    { title: "电话、邮箱与地址", description: "修改全站公共联系资料", href: "/admin/settings" },
  ],
  global: [
    { title: "全站 SEO", description: "搜索标题、描述、分享图片和 Sitemap", href: "/admin/seo" },
    { title: "媒体文件", description: "上传 Logo、图片、PDF 和其他文件", href: "/admin/media" },
  ],
};

export default async function ContentAdminPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser("pages.read");
  const requested = (await searchParams).page || "home";
  const active = pages.find((item) => item.key === requested) || pages[0];
  const [bannerCount, sectionCount] = await Promise.all([
    db.banner.count({ where: { page: active.key } }),
    db.pageSection.count({ where: { page: active.key } }),
  ]);

  return <AdminShell user={user} title={`前台页面管理 / ${active.label}`}>
    <section className="admin-panel home-admin-intro">
      <div><h2>前台页面管理</h2><p>先选择页面，再按前台从上到下的顺序修改。标题、说明、按钮、数字、列表和图片都在同一张区块卡片里，不需要寻找代码字段。</p></div>
      <div className="home-admin-links">{active.key === "factory" && <Link className="btn btn-primary btn-sm" href="#factory-workshops-manager">直接修改生产线等六项</Link>}<Link className="btn btn-outline btn-sm" href={active.href} target="_blank">查看{active.label}前台</Link><Link className="btn btn-outline btn-sm" href="/admin/media">媒体文件与本地上传</Link></div>
    </section>

    <nav className="home-editor-tabs page-editor-tabs" aria-label="选择需要修改的前台页面">
      {pages.map((item) => <Link key={item.key} href={`/admin/content?page=${item.key}`} className={active.key === item.key ? "active" : ""} aria-current={active.key === item.key ? "page" : undefined}>
        <span className="home-editor-tab-icon"><Globe2 size={18} /></span><span><strong>{item.label}</strong><small>{item.help}</small></span>
      </Link>)}
    </nav>

    <section className="home-editor-explainer">
      <strong>当前正在修改：{active.label}</strong>
      <span>{active.key === "global" ? "这里修改全站共用的 Logo、公司名称、联系方式、社媒、报价条、页脚文字和顶部菜单。" : `首屏有 ${bannerCount} 条内容，正文有 ${sectionCount} 个区块。点击蓝色编辑按钮即可修改，保存后前台直接读取数据库。`}</span>
    </section>

    {active.key === "global" ? <>
      <AdminManager sectionKey="settings" headingOverride="全站品牌、联系信息与网站底部" descriptionOverride="Logo、公司中英文名称、联系方式、社媒地址、报价条、底部栏目和订阅说明都在这里直接填写" />
      <div className="mt-3"><AdminManager sectionKey="navigation" fixedFilter={{ location: "HEADER" }} headingOverride="前台顶部菜单" descriptionOverride="修改顶部菜单的文字、链接、显示状态和顺序" /></div>
      <div className="mt-3"><AdminManager sectionKey="navigation" fixedFilter={{ location: "FOOTER" }} headingOverride="网站底部快速链接" descriptionOverride="修改网站底部链接的文字、地址、显示状态和顺序" /></div>
    </> : <>
      <AdminManager sectionKey="banners" fixedFilter={{ page: active.key }} headingOverride={`${active.label}首屏文字与背景图`} descriptionOverride="主标题、强调标题、说明、按钮、背景图和轮播顺序" presentation="page-banners" pageLabel={active.label} />
      <div className="mt-3"><AdminManager sectionKey="page-sections" fixedFilter={{ page: active.key }} headingOverride={`${active.label}正文内容`} descriptionOverride="按照前台顺序修改每个区域的文字、数字、列表、按钮和图片" presentation="page-sections" pageLabel={active.label} /></div>
      {active.key === "quality" && <>
        <div className="mt-3"><AdminManager sectionKey="certificates" headingOverride="认证资质照片（逐张上传）" descriptionOverride="CE、FCC、RoHS、3C、UN38.3 等认证都在这里逐项上传完整证书照片、修改文字和显示顺序" /></div>
        <div className="mt-3"><AdminManager sectionKey="workshops" headingOverride="车间环境六项（逐项换图）" descriptionOverride="生产线、标准着装员工、质量检验区、包装区域、仓库和物流装运区均可单独修改名称、说明和图片" /></div>
      </>}
      {active.key === "factory" && <>
        <div className="mt-3"><AdminManager sectionKey="equipment" headingOverride="工厂设备卡片（逐项换图）" descriptionOverride="逐台修改设备名称、说明、图片和顺序" /></div>
        <div className="mt-3" id="factory-workshops-manager"><AdminManager sectionKey="workshops" headingOverride="车间环境六项（逐项换图）" descriptionOverride="这里就是前台‘生产线’等六张卡片的修改位置：可逐项本地上传图片、修改中英文名称和说明、调整顺序或隐藏。" /></div>
      </>}
    </>}

    <section className="admin-panel home-related-manager mt-3">
      <div className="admin-panel-head"><div><h2>{active.label}关联内容</h2><p>产品、新闻、设备等重复卡片在对应内容库维护，入口集中放在这里。</p></div></div>
      <div className="home-related-grid">{(related[active.key] || []).map((item, index) => {
        const icons = [Boxes, Factory, ImageIcon, FileText, Newspaper, Mail, Building2, Settings, PanelsTopLeft];
        const Icon = icons[index % icons.length];
        return <Link className="home-related-card" href={item.href} key={item.href}><span className="icon-badge"><Icon size={19} /></span><span><strong>{item.title}</strong><small>{item.description}</small></span><b>进入修改 →</b></Link>;
      })}</div>
    </section>
  </AdminShell>;
}
