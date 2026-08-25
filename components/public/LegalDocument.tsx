import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { db } from "@/lib/db";
import { getLocale, translateEntity } from "@/lib/i18n";

type LegalKind = "privacy" | "terms";

const documents = {
  privacy: {
    slug: "privacy",
    seedContent: "We collect and process contact details only to respond to business inquiries, provide requested quotations and meet legal obligations.",
    en: {
      title: "Privacy Policy",
      excerpt: "How we collect, use and protect website visitor and business inquiry information.",
      content: `## Information we collect
We may collect contact details, company information, inquiry content, uploaded documents, subscription preferences, IP address, browser information, visited pages and approximate IP-based country, region or city.

## How we use information
We use information to answer inquiries, prepare quotations, manage sales follow-up, provide requested services, send subscribed news or product updates, protect the website, prevent abuse and improve website performance.

## Cookies and visitor analytics
Non-essential visit analytics are recorded only after the visitor accepts the statistics cookie option. The administration system may show page views, anonymous visitor identifiers, source URLs, device type, IP address and approximate IP-based location. You can reject or clear cookies in your browser.

## Inquiry files and business communications
Documents submitted through the inquiry form are stored securely and are available only to authorized personnel. Please do not upload confidential information unless it is needed for your project.

## Sharing and international processing
We do not sell personal information. Information may be processed by authorized employees and trusted service providers that support hosting, security, email delivery or business operations, subject to appropriate safeguards.

## Retention and security
We retain records only for legitimate business, security and legal purposes. We use access controls, password hashing, audit logs, rate limiting and other reasonable safeguards, but no internet transmission is completely risk-free.

## Your choices and rights
You may request access, correction or deletion of your information, object to certain processing, or unsubscribe from marketing messages. Legal retention requirements may limit some deletion requests.

## Contact and updates
Contact us through the website inquiry form for privacy questions. We may update this policy when our services or legal obligations change. The current version published on this page applies.`,
    },
    zh: {
      title: "隐私政策",
      excerpt: "说明我们如何收集、使用和保护网站访客及商业询盘信息。",
      content: `## 我们收集的信息
我们可能收集联系人资料、公司信息、询盘内容、上传文件、订阅偏好、IP 地址、浏览器信息、访问页面，以及依据 IP 粗略识别的国家、地区或城市。

## 信息使用方式
我们使用这些信息回复询盘、准备报价、管理销售跟进、提供客户要求的服务、发送已订阅的新闻或新品通知、防止滥用并改进网站性能。

## Cookie 与访问统计
只有访客同意统计 Cookie 后，系统才记录非必要的访问分析。后台可能显示浏览量、匿名访客标识、来源网址、设备类型、IP 地址及依据 IP 得出的粗略地区。您可在浏览器中拒绝或清除 Cookie。

## 询盘文件与商务沟通
通过询盘表单提交的文件会被安全存储，仅授权人员可访问。除非项目确有需要，请勿上传不必要的机密信息。

## 信息共享与跨境处理
我们不会出售个人信息。为提供主机、安全、邮件发送或业务运营服务，信息可能由授权员工和可信服务商在适当保护措施下处理。

## 保存期限与安全措施
我们仅基于合理的业务、安全和法律需要保存记录，并采用访问控制、密码哈希、审计日志、频率限制等措施。但任何互联网传输都无法保证绝对安全。

## 您的选择与权利
您可以请求访问、更正或删除信息，反对特定处理，或取消营销邮件订阅。法律规定的保存义务可能会限制部分删除请求。

## 联系与更新
如有隐私问题，请通过网站询盘表单联系我们。当服务或法律义务发生变化时，我们可能更新本政策，以本页面当前发布版本为准。`,
    },
  },
  terms: {
    slug: "terms",
    seedContent: "These terms govern access to and use of the ENERCORE website.",
    en: {
      title: "Terms of Use",
      excerpt: "Terms governing access to and use of this B2B manufacturing website.",
      content: `## Website use
You may use this website for lawful business research, product evaluation and communication with our team. Access to the website does not create a supplier, distributor, agency or other commercial relationship.

## Product and company information
Website content is provided for general reference. Product specifications, certifications, availability, lead times and manufacturing capabilities may change and must be confirmed in an official quotation or agreement.

## Quotations and orders
An inquiry or quotation request is not an order. Prices, tooling, minimum order quantities, payment terms, delivery schedules, warranties and acceptance criteria become binding only when confirmed in a written agreement accepted by authorized parties.

## Intellectual property
Website text, graphics, product presentations, trademarks, logos and downloadable materials are protected by applicable intellectual-property laws. They may not be copied, republished or used commercially without permission.

## Prohibited activity
You must not attack, scan, overload, scrape without authorization, bypass security controls, upload malicious files, impersonate another person or use the website for unlawful or misleading purposes.

## External links
Links to external websites, maps or social platforms are provided for convenience. We do not control their content, availability or privacy practices.

## Disclaimer and limitation
We aim to keep information accurate and the website available, but provide no guarantee that every page is error-free or uninterrupted. To the extent permitted by law, we are not liable for indirect losses resulting solely from reliance on general website content.

## Changes and contact
We may update these terms when the website or applicable requirements change. Continued use after publication means you accept the updated terms. Contact us through the inquiry page if you have questions.`,
    },
    zh: {
      title: "使用条款",
      excerpt: "适用于访问和使用本 B2B 制造业网站的条款。",
      content: `## 网站使用
您可以将本网站用于合法的商务调研、产品评估及与我们团队沟通。访问网站本身不会建立供应商、经销商、代理或其他商业关系。

## 产品与公司信息
网站内容仅供一般参考。产品规格、认证、供应情况、交期和制造能力可能调整，最终应以正式报价或书面协议确认为准。

## 报价与订单
提交询盘或报价请求不等同于下单。价格、模具、最低订购量、付款条款、交付计划、质保和验收标准，只有经授权双方书面确认后才具有约束力。

## 知识产权
网站文字、图片、产品展示、商标、Logo 及下载资料受相关知识产权法律保护。未经许可，不得复制、重新发布或用于商业用途。

## 禁止行为
不得攻击、扫描、过载网站，未经授权抓取内容，绕过安全措施，上传恶意文件，冒充他人，或将网站用于违法和误导性活动。

## 外部链接
网站提供的外部网站、地图或社交平台链接仅为方便访问，我们无法控制其内容、可用性或隐私处理方式。

## 免责声明与责任限制
我们会尽力确保信息准确和网站可用，但不保证所有页面始终无错误或不中断。在法律允许范围内，我们不对仅因依赖网站一般信息而产生的间接损失承担责任。

## 条款变更与联系
当网站或相关要求变化时，我们可能更新本条款。更新发布后继续使用网站即表示接受更新内容。如有疑问，请通过询盘页面联系我们。`,
    },
  },
} as const;

function ContentBlocks({ content }: { content: string }) {
  return <div className="legal-document-body">{content.split(/\n{2,}/).map((block, index) => {
    const lines = block.trim().split("\n");
    if (lines[0]?.startsWith("## ")) return <section key={`${lines[0]}-${index}`}><h2>{lines[0].slice(3)}</h2>{lines.slice(1).length > 0 && <p>{lines.slice(1).join("\n")}</p>}</section>;
    if (lines.every((line) => line.startsWith("- "))) return <ul key={`list-${index}`}>{lines.map((line) => <li key={line}>{line.slice(2)}</li>)}</ul>;
    return <p key={`paragraph-${index}`}>{block}</p>;
  })}</div>;
}

export async function LegalDocument({ kind }: { kind: LegalKind }) {
  const locale = await getLocale();
  const zh = locale === "zh";
  const defaults = documents[kind];
  const raw = await db.page.findUnique({ where: { slug: defaults.slug } }).catch(() => null);
  const localized = raw ? await translateEntity("Page", raw, ["title", "excerpt", "content"], locale) : null;
  const hasLocalizedContent = Boolean(raw && localized && localized.content !== raw.content);
  const useStoredEnglish = Boolean(raw?.status === "PUBLISHED" && raw.content !== defaults.seedContent);
  const title = zh
    ? (hasLocalizedContent ? String(localized?.title || defaults.zh.title) : defaults.zh.title)
    : String(raw?.title || defaults.en.title);
  const excerpt = zh
    ? (hasLocalizedContent ? String(localized?.excerpt || defaults.zh.excerpt) : defaults.zh.excerpt)
    : String(raw?.excerpt || defaults.en.excerpt);
  const content = zh
    ? (hasLocalizedContent ? String(localized?.content || defaults.zh.content) : defaults.zh.content)
    : (useStoredEnglish ? String(raw?.content) : defaults.en.content);

  return <>
    <section className="legal-page-hero">
      <div className="container-site">
        <span className="legal-page-icon"><ShieldCheck size={24} /></span>
        <div><div className="eyebrow">{zh ? "法律与网站信息" : "Legal & Website Information"}</div><h1>{title}</h1><p>{excerpt}</p></div>
      </div>
    </section>
    <section className="section legal-page-section"><div className="container-site legal-page-layout">
      <article className="card legal-document-card"><ContentBlocks content={content} /></article>
      <aside className="card legal-side-card"><strong>{zh ? "需要帮助？" : "Need help?"}</strong><p>{zh ? "如对本页面内容或您的资料处理方式有疑问，请联系我们。" : "Contact us if you have questions about this page or how your information is handled."}</p><Link className="btn btn-primary btn-sm" href="/contact">{zh ? "联系我们" : "Contact Us"}</Link></aside>
    </div></section>
  </>;
}
