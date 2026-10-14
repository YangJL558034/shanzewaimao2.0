import { requireUser } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { SystemStatus } from "@/components/admin/SystemStatus";
export default async function SystemPage(){const user=await requireUser("security.read");return <AdminShell user={user} title="安全中心"><SystemStatus/></AdminShell>}
