import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { renderTemplate } from "@/lib/email";

export type PublicationKind = "news" | "product";

type DefaultTemplate = {
  key: string;
  name: string;
  subject: string;
  html: string;
  text: string;
};

const templateVariables = "{{title}}、{{summary}}、{{url}}、{{companyName}}、{{unsubscribeUrl}}";

export const newsletterDefaultTemplates: DefaultTemplate[] = [
  {
    key: "newsletter_news_published_en",
    name: "订阅通知｜新闻发布（英文）",
    subject: "New from {{companyName}}: {{title}}",
    html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#10213b"><h2>{{title}}</h2><p>{{summary}}</p><p><a href="{{url}}" style="display:inline-block;padding:12px 20px;background:#0865e8;color:#fff;text-decoration:none;border-radius:6px">Read the full update</a></p><hr style="border:0;border-top:1px solid #e5e7eb;margin:28px 0"><p style="font-size:12px;color:#64748b">You received this email because you subscribed to {{companyName}} updates. <a href="{{unsubscribeUrl}}">Unsubscribe</a></p></div>`,
    text: "{{title}}\n\n{{summary}}\n\nRead more: {{url}}\n\nUnsubscribe: {{unsubscribeUrl}}",
  },
  {
    key: "newsletter_news_published_zh",
    name: "订阅通知｜新闻发布（中文）",
    subject: "{{companyName}} 最新动态：{{title}}",
    html: `<div style="font-family:Arial,'Microsoft YaHei',sans-serif;max-width:640px;margin:auto;color:#10213b"><h2>{{title}}</h2><p>{{summary}}</p><p><a href="{{url}}" style="display:inline-block;padding:12px 20px;background:#0865e8;color:#fff;text-decoration:none;border-radius:6px">查看完整动态</a></p><hr style="border:0;border-top:1px solid #e5e7eb;margin:28px 0"><p style="font-size:12px;color:#64748b">您收到此邮件是因为订阅了 {{companyName}} 的资讯。<a href="{{unsubscribeUrl}}">取消订阅</a></p></div>`,
    text: "{{title}}\n\n{{summary}}\n\n查看详情：{{url}}\n\n取消订阅：{{unsubscribeUrl}}",
  },
  {
    key: "newsletter_product_published_en",
    name: "订阅通知｜新品发布（英文）",
    subject: "New product from {{companyName}}: {{title}}",
    html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#10213b"><p style="color:#0865e8;font-weight:700">NEW PRODUCT</p><h2>{{title}}</h2><p>{{summary}}</p><p><a href="{{url}}" style="display:inline-block;padding:12px 20px;background:#0865e8;color:#fff;text-decoration:none;border-radius:6px">View product details</a></p><hr style="border:0;border-top:1px solid #e5e7eb;margin:28px 0"><p style="font-size:12px;color:#64748b">You received this email because you subscribed to {{companyName}} updates. <a href="{{unsubscribeUrl}}">Unsubscribe</a></p></div>`,
    text: "New product: {{title}}\n\n{{summary}}\n\nView product: {{url}}\n\nUnsubscribe: {{unsubscribeUrl}}",
  },
  {
    key: "newsletter_product_published_zh",
    name: "订阅通知｜新品发布（中文）",
    subject: "{{companyName}} 新品发布：{{title}}",
    html: `<div style="font-family:Arial,'Microsoft YaHei',sans-serif;max-width:640px;margin:auto;color:#10213b"><p style="color:#0865e8;font-weight:700">新品发布</p><h2>{{title}}</h2><p>{{summary}}</p><p><a href="{{url}}" style="display:inline-block;padding:12px 20px;background:#0865e8;color:#fff;text-decoration:none;border-radius:6px">查看产品详情</a></p><hr style="border:0;border-top:1px solid #e5e7eb;margin:28px 0"><p style="font-size:12px;color:#64748b">您收到此邮件是因为订阅了 {{companyName}} 的资讯。<a href="{{unsubscribeUrl}}">取消订阅</a></p></div>`,
    text: "新品发布：{{title}}\n\n{{summary}}\n\n查看产品：{{url}}\n\n取消订阅：{{unsubscribeUrl}}",
  },
];

export async function ensureNewsletterTemplates() {
  await Promise.all(
    newsletterDefaultTemplates.map((template) =>
      db.emailTemplate.upsert({
        where: { key: template.key },
        update: {},
        create: { ...template, isActive: true },
      }),
    ),
  );
}

function publicSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

function newsletterSecret() {
  return process.env.APP_SECRET || process.env.AUTH_SECRET || "enercore-local-newsletter-secret";
}

export function createUnsubscribeToken(email: string) {
  return createHmac("sha256", newsletterSecret()).update(email.trim().toLowerCase()).digest("hex");
}

export function verifyUnsubscribeToken(email: string, token: string) {
  const expected = Buffer.from(createUnsubscribeToken(email), "hex");
  const received = Buffer.from(token || "", "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value)
    ? value
    : `<div style="font-family:Arial,'Microsoft YaHei',sans-serif;white-space:pre-line">${escapeHtml(value)}</div>`;
}

async function translatedPublication(
  entityType: "News" | "Product",
  entityId: string,
  locale: string,
  original: { title: string; summary: string },
) {
  if (locale === "en") return original;
  const localeRecord = await db.locale.findUnique({ where: { code: locale }, select: { id: true, isActive: true } });
  if (!localeRecord?.isActive) return original;
  const rows = await db.translation.findMany({
    where: { localeId: localeRecord.id, entityType, entityId, field: { in: entityType === "News" ? ["title", "excerpt"] : ["name", "summary"] } },
  });
  const values = Object.fromEntries(rows.map((row) => [row.field, row.value]));
  return entityType === "News"
    ? { title: values.title || original.title, summary: values.excerpt || original.summary }
    : { title: values.name || original.title, summary: values.summary || original.summary };
}

export async function queuePublicationNotification(kind: PublicationKind, id: string) {
  await ensureNewsletterTemplates();
  const newsRecord = kind === "news"
    ? await db.news.findUnique({ where: { id }, select: { id: true, title: true, excerpt: true, slug: true, status: true } })
    : null;
  const productRecord = kind === "product"
    ? await db.product.findUnique({ where: { id }, select: { id: true, name: true, summary: true, slug: true, status: true } })
    : null;
  if (newsRecord?.status !== "PUBLISHED" && productRecord?.status !== "PUBLISHED") return { queued: 0, skipped: 0 };

  const subscribers = await db.newsletterSubscriber.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  if (!subscribers.length) return { queued: 0, skipped: 0 };

  const companySetting = await db.setting.findUnique({ where: { key: "company_name" } });
  const companyName = companySetting?.value || "Shanze New Energy Technology Co., Ltd.";
  const baseUrl = publicSiteUrl();
  const slug = newsRecord?.slug || productRecord?.slug || "";
  const url = `${baseUrl}/${kind === "news" ? "news" : "products"}/${encodeURIComponent(slug)}`;
  const original = newsRecord
    ? { title: newsRecord.title, summary: newsRecord.excerpt }
    : { title: productRecord!.name, summary: productRecord!.summary };

  let queued = 0;
  let skipped = 0;
  for (const locale of ["en", "zh"]) {
    const localeSubscribers = subscribers.filter((subscriber) => (subscriber.locale === "zh" ? "zh" : "en") === locale);
    if (!localeSubscribers.length) continue;
    const templateKey = `newsletter_${kind}_published_${locale}`;
    const template = await db.emailTemplate.findUnique({ where: { key: templateKey } });
    if (!template?.isActive) {
      skipped += localeSubscribers.length;
      continue;
    }
    const content = await translatedPublication(kind === "news" ? "News" : "Product", id, locale, original);
    const notificationKey = `${kind}:${id}`;
    const alreadyQueued = await db.emailQueue.findMany({
      where: { templateKey, payloadJson: { contains: `\"notificationKey\":\"${notificationKey}\"` } },
      select: { to: true },
    });
    const existingRecipients = new Set(alreadyQueued.map((job) => job.to.toLowerCase()));
    const jobs = [];
    for (const subscriber of localeSubscribers) {
      if (existingRecipients.has(subscriber.email.toLowerCase())) {
        skipped++;
        continue;
      }
      const payloadJson = JSON.stringify({ notificationKey, subscriberId: subscriber.id });
      const unsubscribeUrl = `${baseUrl}/api/newsletter?email=${encodeURIComponent(subscriber.email)}&token=${createUnsubscribeToken(subscriber.email)}`;
      const variables = {
        title: escapeHtml(content.title),
        summary: escapeHtml(content.summary),
        url,
        companyName: escapeHtml(companyName),
        unsubscribeUrl,
      };
      jobs.push({
        templateKey,
        to: subscriber.email,
        subject: renderTemplate(template.subject, variables),
        html: renderTemplate(normalizeHtml(template.html), variables),
        text: renderTemplate(template.text || `${content.title}\n\n${content.summary}\n\n${url}`, variables),
        payloadJson,
      });
    }
    for (let index = 0; index < jobs.length; index += 200) {
      const result = await db.emailQueue.createMany({ data: jobs.slice(index, index + 200) });
      queued += result.count;
    }
  }
  return { queued, skipped };
}

export const newsletterTemplateVariableHelp = templateVariables;
