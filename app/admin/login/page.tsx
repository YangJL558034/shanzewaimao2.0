import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/admin/LoginForm";
export default async function LoginPage(){if(await getCurrentUser())redirect("/admin");return <div className="admin-screen admin-login"><div className="login-visual"><div className="brand footer-brand"><span className="brand-mark">E</span><span><span className="brand-name">ENERCORE</span><span className="brand-tag !text-blue-100">MANUFACTURING CMS</span></span></div><div><ShieldCheck size={48}/><h1>One secure center for content, leads and global growth.</h1><p>Production-grade RBAC, inquiry CRM, audit trails and business content management.</p></div><small>Protected by hashed credentials, secure sessions and account lockout.</small></div><div className="login-card-wrap"><LoginForm/></div></div>}
