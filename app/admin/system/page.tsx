import { requireUser } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { SystemStatus } from "@/components/admin/SystemStatus";
export default async function SystemPage(){const user=await requireUser("settings.read");return <AdminShell user={user} title="系统状态"><SystemStatus/></AdminShell>}
