import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/security";
import { verifyUnsubscribeToken } from "@/lib/newsletter";
import { consumeNewsletterChallenge, verifyNewsletterChallenge } from "@/lib/newsletter-challenge";

const subscriptionSchema = z.object({
  email: z.string().email().max(254),
  locale: z.enum(["en", "zh"]).default("en"),
  challengeToken: z.string().min(40).max(500),
  slidePosition: z.coerce.number().min(0).max(100),
  website: z.string().max(0).optional().default(""),
});

function sameSite(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const requestHost = forwardedHost || request.headers.get("host") || new URL(request.url).host;
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = String(url.searchParams.get("email") || "").trim().toLowerCase();
  const token = String(url.searchParams.get("token") || "");
  if (!z.string().email().safeParse(email).success || !verifyUnsubscribeToken(email, token)) {
    return NextResponse.json({ error: "Invalid unsubscribe link" }, { status: 400 });
  }
  await db.newsletterSubscriber.updateMany({ where: { email }, data: { isActive: false, unsubscribedAt: new Date() } });
  return NextResponse.redirect(new URL("/?unsubscribed=1", request.url), 303);
}

export async function POST(request: Request) {
  if (!sameSite(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const ip = getClientIp(request);
  const rate = await checkRateLimit(`newsletter:${ip}`, 5, 3600);
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const type = request.headers.get("content-type") || "";
  let input: Record<string, unknown> = {};
  const wantsJson = type.includes("application/json");
  if (wantsJson) {
    input = await request.json();
  } else {
    const form = await request.formData();
    input = { email: form.get("email"), locale: form.get("locale"), challengeToken: form.get("challengeToken"), slidePosition: form.get("slidePosition"), website: form.get("website") };
  }
  const parsed = subscriptionSchema.safeParse({
    email: String(input.email || "").toLowerCase().trim(),
    locale: input.locale === "zh" ? "zh" : "en",
    challengeToken: String(input.challengeToken || ""),
    slidePosition: input.slidePosition,
    website: String(input.website || ""),
  });
  if (!parsed.success) return NextResponse.json({ error: input.locale === "zh" ? "请输入有效的邮箱地址。" : "Please enter a valid email address." }, { status: 400 });
  if (!verifyNewsletterChallenge(request, parsed.data.challengeToken, parsed.data.slidePosition)) {
    return NextResponse.json({ error: parsed.data.locale === "zh" ? "请重新完成滑动验证。" : "Please complete the slider verification again." }, { status: 400 });
  }
  const tokenExpiresAt = new Date(Number(parsed.data.challengeToken.split(".")[1]));
  if (!(await consumeNewsletterChallenge(parsed.data.challengeToken, tokenExpiresAt))) {
    return NextResponse.json({ error: parsed.data.locale === "zh" ? "验证已使用，请重新滑动验证。" : "Verification already used. Please slide again." }, { status: 409 });
  }
  const existing = await db.newsletterSubscriber.findUnique({ where: { email: parsed.data.email }, select: { isActive: true } });
  await db.newsletterSubscriber.upsert({
    where: { email: parsed.data.email },
    update: { isActive: true, unsubscribedAt: null, consentAt: new Date(), locale: parsed.data.locale, source: "website" },
    create: { email: parsed.data.email, locale: parsed.data.locale, source: "website" },
  });
  if (wantsJson) {
    return NextResponse.json({
      ok: true,
      alreadySubscribed: Boolean(existing?.isActive),
      message: parsed.data.locale === "zh"
        ? existing?.isActive ? "这个邮箱已经订阅，无需重复提交。" : "订阅成功！新闻和新品发布后会发送到您的邮箱。"
        : existing?.isActive ? "This email is already subscribed." : "Subscribed! News and product updates will be sent to your inbox.",
    });
  }
  return NextResponse.redirect(new URL("/?subscribed=1", request.url), 303);
}
