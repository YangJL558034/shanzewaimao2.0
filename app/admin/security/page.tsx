import { requireUser } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { SecurityManager } from "@/components/admin/SecurityManager";
export default async function SecurityPage(){const user=await requireUser("security.read");return <AdminShell user={user} title="用户与权限"><SecurityManager/></AdminShell>}
