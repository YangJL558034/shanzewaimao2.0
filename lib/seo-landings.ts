export const seoLandings = {
  "power-bank-manufacturer": {
    title: "Power Bank Manufacturer in China | OEM/ODM | Shanze",
    description: "Shanze manufactures magnetic and portable power banks for global B2B brands, with OEM/ODM product, branding and packaging support.",
    h1: "Professional Power Bank Manufacturer in China",
    intro: "OEM/ODM power bank development for brands, distributors and sourcing teams, supported by product engineering, manufacturing and quality control.",
    focus: ["Magnetic power banks", "Portable power banks", "Custom branding and packaging", "B2B project support"],
  },
  "magnetic-power-bank-manufacturer": {
    title: "Magnetic Power Bank Manufacturer | OEM Solutions | Shanze",
    description: "Source OEM magnetic power banks from Shanze. Explore published models and discuss custom branding, packaging and target-market requirements.",
    h1: "Magnetic Power Bank Manufacturer for Global Brands",
    intro: "Develop magnetic power bank programs around your confirmed product requirements, visual identity, packaging and target market.",
    focus: ["Magnetic alignment", "Portable formats", "Published product models", "OEM visual customization"],
  },
  "semi-solid-state-power-bank": {
    title: "Semi-Solid-State Power Bank OEM/ODM | Shanze",
    description: "Discuss semi-solid-state power bank development with Shanze for B2B and OEM/ODM projects. Specifications are confirmed for each project before sampling.",
    h1: "Semi-Solid-State Power Bank OEM/ODM Solutions",
    intro: "A dedicated project page for brands evaluating semi-solid-state portable charging products. Technical specifications and compliance needs are confirmed project by project.",
    focus: ["Project requirement review", "Industrial design coordination", "Prototype confirmation", "Quality documentation support"],
  },
  "power-bank-oem-odm": {
    title: "Power Bank OEM/ODM Services | Product Development | Shanze",
    description: "Shanze supports power bank OEM/ODM projects from requirement review and design through sampling, manufacturing, quality control and packaging.",
    h1: "Power Bank OEM/ODM Manufacturing Services",
    intro: "A structured development path for B2B charging product programs, connecting product definition, engineering, manufacturing and delivery preparation.",
    focus: ["Requirement definition", "Sampling and validation", "Brand and packaging artwork", "Production quality control"],
  },
  "wireless-charger-manufacturer": {
    title: "Wireless Charger Manufacturer | OEM/ODM Factory | Shanze",
    description: "Explore Shanze wireless charger manufacturing and OEM/ODM support for published charging pads, stands and multi-device charging products.",
    h1: "Wireless Charger Manufacturer & OEM/ODM Partner",
    intro: "Wireless charging product support for brands and distributors, covering published models, project customization and manufacturing coordination.",
    focus: ["Charging pads", "Charging stands", "Multi-device formats", "Custom brand presentation"],
  },
  "custom-power-bank": {
    title: "Custom Power Bank Manufacturer | Private Label OEM | Shanze",
    description: "Create custom power bank programs with Shanze, including product selection, logo, color, packaging and documentation based on confirmed requirements.",
    h1: "Custom Power Bank Manufacturing for Your Brand",
    intro: "Build a branded power bank program using confirmed product options and a clear sampling process before mass production.",
    focus: ["Private label", "Color and finish options", "Retail packaging", "Project documentation"],
  },
  "power-bank-factory-china": {
    title: "Power Bank Factory in China | Manufacturing & QC | Shanze",
    description: "Learn how Shanze supports power bank manufacturing projects in China through equipment, controlled processes, testing and B2B project service.",
    h1: "Power Bank Factory in China for B2B Projects",
    intro: "Connect product development with manufacturing, process control and documented quality activities for international B2B programs.",
    focus: ["Manufacturing equipment", "Controlled production stages", "Quality inspection", "Global project communication"],
  },
} as const;

export type SeoLandingSlug = keyof typeof seoLandings;
export function isSeoLandingSlug(value: string): value is SeoLandingSlug { return value in seoLandings; }
