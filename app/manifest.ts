import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shanze New Energy Technology Co., Ltd.",
    short_name: "Shanze",
    description: "OEM/ODM charging products manufacturer",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#075bd8",
    icons: [
      {
        src: "/shanze-brand-icon.png?v=20260824",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
