import Link from "next/link";
import { CheckCircle2, CircleAlert, MailX } from "lucide-react";

export const metadata = { title: "取消订阅" };

const messages = {
  success: { icon: CheckCircle2, title: "已成功取消订阅", text: "您的邮箱已停止接收新闻和新品通知。", tone: "success" },
  already: { icon: MailX, title: "此前已经取消订阅", text: "该邮箱目前不会接收订阅邮件，无需重复操作。", tone: "success" },
  "not-found": { icon: CircleAlert, title: "没有找到订阅记录", text: "该邮箱可能已被删除，或者从未订阅过网站资讯。", tone: "warning" },
  invalid: { icon: CircleAlert, title: "取消订阅链接已失效", text: "链接可能来自旧邮件，或服务器安全密钥已经更换。请联系网站管理员处理。", tone: "warning" },
} as const;

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const message = messages[status as keyof typeof messages] || messages.invalid;
  const Icon = message.icon;
  return <main className="unsubscribe-page"><section className={`unsubscribe-card ${message.tone}`}><span className="unsubscribe-icon"><Icon size={34} /></span><h1>{message.title}</h1><p>{message.text}</p><Link className="btn btn-primary" href="/">返回网站首页</Link></section></main>;
}