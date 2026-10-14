import { AdminShell } from "@/components/admin/AdminShell";
import { SeoIntegrationSettings } from "@/components/admin/SeoIntegrationSettings";
import { requireUser } from "@/lib/auth";

export default async function SeoToolsPage() {
  const user = await requireUser("seo.read");
  return <AdminShell user={user} title="Google 与 SEO 配置"><SeoIntegrationSettings canWrite={user.permissions.has("*") || user.permissions.has("seo.write")} /></AdminShell>;
}
