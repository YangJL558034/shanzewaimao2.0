import { Award, Building2, Factory, Globe2, PackageOpen, Users } from "lucide-react";
import { companyProfileStats } from "@/lib/company-profile";

const icons = [Award, Building2, Factory, Globe2, PackageOpen, Users];
export function StatGrid({ items = companyProfileStats.en.map((item) => [item.value, item.title]) }: { items?: string[][] }) {
  return <div className="grid-cards stat-grid">{items.map(([value,label],i) => { const Icon=icons[i%icons.length]; return <div className="card stat" key={label}><Icon size={30}/><strong>{value}</strong><span>{label}</span></div>; })}</div>;
}
