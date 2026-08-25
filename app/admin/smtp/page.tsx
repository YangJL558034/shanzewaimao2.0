import { AdminShell } from "@/components/admin/AdminShell";
import { SmtpSettings } from "@/components/admin/SmtpSettings";
import { requireUser } from "@/lib/auth";

export default async function SmtpPage() {
  const user = await requireUser("settings.read");
  return <AdminShell user={user} title="邮件服务器"><SmtpSettings /></AdminShell>;
}
