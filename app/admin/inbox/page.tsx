import { requireUser } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { CustomerInbox } from "@/components/admin/CustomerInbox";

export default async function CustomerInboxPage() {
  const user = await requireUser("inquiries.read");
  return <AdminShell user={user} title="统一客服中心"><CustomerInbox /></AdminShell>;
}
