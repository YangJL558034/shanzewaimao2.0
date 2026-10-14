import { AdminShell } from "@/components/admin/AdminShell";
import { CustomerChannelSettings } from "@/components/admin/CustomerChannelSettings";
import { requireUser } from "@/lib/auth";
export default async function CustomerChannelsPage() { const user = await requireUser("settings.read"); return <AdminShell user={user} title="客服渠道配置"><CustomerChannelSettings /></AdminShell>; }
