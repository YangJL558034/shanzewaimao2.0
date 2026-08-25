import { Award, Building2, Factory, Globe2, PackageOpen, Users } from "lucide-react";

const icons = [Award, Building2, Factory, Globe2, PackageOpen, Users];
export function StatGrid({ items = [
  ["12+", "Years of Experience"], ["20,000+ m²", "Factory Area"], ["16", "Production Lines"], ["100+", "Export Countries"], ["1,000,000+ pcs", "Monthly Output"], ["300+", "Skilled Employees"],
] }: { items?: string[][] }) {
  return <div className="grid-cards stat-grid">{items.map(([value,label],i) => { const Icon=icons[i%icons.length]; return <div className="card stat" key={label}><Icon size={30}/><strong>{value}</strong><span>{label}</span></div>; })}</div>;
}
