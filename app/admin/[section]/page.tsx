import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCmsSection } from "@/lib/cms";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminManager } from "@/components/admin/AdminManager";
import { InquiryCrm } from "@/components/admin/InquiryCrm";
export default async function AdminSectionPage({params}:{params:Promise<{section:string}>}){const {section:key}=await params;const section=getCmsSection(key);if(!section)notFound();const user=await requireUser(`${section.permission}.read`);return <AdminShell user={user} title={section.label}>{key === "inquiries" ? <InquiryCrm/> : <AdminManager sectionKey={key}/>}</AdminShell>}
