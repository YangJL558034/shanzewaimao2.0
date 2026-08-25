import Link from "next/link";
import {
  Boxes,
  Factory,
  FileSearch,
  Image as ImageIcon,
  LayoutTemplate,
  Menu,
  PanelsTopLeft,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { AdminManager } from "@/components/admin/AdminManager";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

type HomeTab = "hero" | "sections" | "header" | "footer" | "seo" | "related";

export default async function HomeAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser("pages.read");
  const requestedTab = (await searchParams).tab as HomeTab | undefined;
  const can = (permission: string) =>
    user.permissions.has("*") || user.permissions.has(`${permission}.read`);
  const [bannerTotal, publishedBanners, sectionTotal, visibleSections, headerTotal, seoTotal] =
    await Promise.all([
      db.banner.count({ where: { page: "home" } }),
      db.banner.count({ where: { page: "home", status: "PUBLISHED" } }),
      db.pageSection.count({ where: { page: "home" } }),
      db.pageSection.count({ where: { page: "home", isVisible: true } }),
      db.navigationItem.count({ where: { location: "HEADER" } }),
      db.seoMeta.count({ where: { route: "/" } }),
    ]);

  const tabs = [
    { key: "hero" as const, label: "首屏文字与轮播", help: "标题、说明、按钮、背景图", status: `${publishedBanners}/${bannerTotal} 已发布`, icon: ImageIcon, permission: "pages" },
    { key: "sections" as const, label: "首页内容区块", help: "关于、产品、设备、车间、品质", status: `${visibleSections}/${sectionTotal} 显示中`, icon: LayoutTemplate, permission: "pages" },
    { key: "header" as const, label: "顶部菜单", help: "导航名称、链接和顺序", status: `${headerTotal} 个菜单`, icon: Menu, permission: "pages" },
    { key: "footer" as const, label: "公司与网站底部", help: "Logo、公司名、联系信息、页脚", status: "全站共用", icon: Settings, permission: "settings" },
    { key: "seo" as const, label: "首页 SEO", help: "浏览器标题、描述和分享图片", status: seoTotal ? "已配置" : "待配置", icon: FileSearch, permission: "seo" },
    { key: "related" as const, label: "首页列表内容", help: "产品、设备、车间和证书卡片", status: "分别管理", icon: PanelsTopLeft, permission: "pages" },
  ].filter((item) => can(item.permission));
  const activeTab = tabs.some((item) => item.key === requestedTab)
    ? requestedTab!
    : tabs[0]?.key || "hero";

  return (
    <AdminShell user={user} title="首页管理">
      <section className="admin-panel home-admin-intro">
        <div>
          <h2>首页内容控制中心</h2>
          <p>按照前台从上到下的顺序管理内容。点击下方状态栏即可进入对应区域，每个内容卡片都有清楚的编辑按钮，不需要识别代码或数据库字段。</p>
        </div>
        <div className="home-admin-links">
          <Link className="btn btn-outline btn-sm" href="/" target="_blank">查看前台首页</Link>
          <Link className="btn btn-outline btn-sm" href="/admin/media">上传 / 选择图片</Link>
        </div>
      </section>

      <nav className="home-editor-tabs" aria-label="首页内容区域">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={`/admin/home?tab=${item.key}#home-editor`}
              className={activeTab === item.key ? "active" : ""}
              aria-current={activeTab === item.key ? "page" : undefined}
            >
              <span className="home-editor-tab-icon"><Icon size={19} /></span>
              <span><strong>{item.label}</strong><small>{item.help}</small></span>
              <em>{item.status}</em>
            </Link>
          );
        })}
      </nav>

      <div id="home-editor" className="home-editor-content">
        {activeTab === "hero" && (
          <>
            <section className="home-editor-explainer">
              <strong>前台最上方大标题和背景图就在这里修改</strong>
              <span>每张卡片是一张轮播内容。图片或视频都可本地上传；新增并发布 2 张以上后，每 2 秒平滑切换，顺序可自由调整。</span>
            </section>
            <AdminManager
              sectionKey="banners"
              fixedFilter={{ page: "home" }}
              headingOverride="首页首屏轮播"
              descriptionOverride="直接管理前台首页最上方的文字、按钮和背景图"
              presentation="home-banners"
              pageLabel="首页"
            />
          </>
        )}
        {activeTab === "sections" && (
          <>
            <section className="home-editor-explainer">
              <strong>前台首屏下方的文字和配图在这里修改</strong>
              <span>卡片顺序与前台一致。点击对应卡片的“编辑文字与图片”，保存后前台会自动读取。</span>
            </section>
            <AdminManager
              sectionKey="page-sections"
              fixedFilter={{ page: "home" }}
              headingOverride="首页内容区块"
              descriptionOverride="关于我们、产品、生产设备、车间环境和品质认证区域"
              presentation="home-sections"
            />
          </>
        )}
        {activeTab === "header" && (
          <AdminManager
            sectionKey="navigation"
            fixedFilter={{ location: "HEADER" }}
            headingOverride="前台顶部菜单"
            descriptionOverride="修改前台顶部菜单名称、跳转地址、显示状态和排列顺序"
          />
        )}
        {activeTab === "footer" && (
          <AdminManager
            sectionKey="settings"
            headingOverride="公司与网站底部设置"
            descriptionOverride="修改前台 Logo、公司名称、联系方式、社媒链接、底部栏目和报价区域"
          />
        )}
        {activeTab === "seo" && (
          <AdminManager
            sectionKey="seo"
            fixedFilter={{ route: "/" }}
            headingOverride="首页搜索与分享设置"
            descriptionOverride="修改浏览器标签标题、搜索摘要、关键词和社交分享图片"
          />
        )}
        {activeTab === "related" && (
          <section className="admin-panel home-related-manager">
            <div className="admin-panel-head">
              <div><h2>首页卡片内容来源</h2><p>首页中的列表卡片来自以下内容库，点击即可修改对应的文字和图片。</p></div>
            </div>
            <div className="home-related-grid">
              {[
                [Boxes, "产品栏目", "首页 Our Products 下方的分类图片与文字", "/admin/categories"],
                [Factory, "生产设备", "首页 Advanced Production Equipment 卡片", "/admin/equipment"],
                [LayoutTemplate, "车间环境", "首页 Workshop Environment 图片与说明", "/admin/workshops"],
                [ShieldCheck, "品质证书", "首页 Quality & Certifications 证书", "/admin/certificates"],
              ].map(([Icon, title, description, href]) => {
                const CardIcon = Icon as typeof Boxes;
                return (
                  <Link href={String(href)} className="home-related-card" key={String(title)}>
                    <span className="icon-badge"><CardIcon size={20} /></span>
                    <span><strong>{String(title)}</strong><small>{String(description)}</small></span>
                    <b>进入修改 →</b>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </AdminShell>
  );
}
