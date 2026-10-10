import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.shanzesz.com" }],
        destination: "https://shanzesz.com/:path*",
        permanent: true,
      },
    ];
  },
  // Allow the development server to be opened from phones/tablets on the
  // same network. Production builds are unaffected by this setting.
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS || "localhost,localhost:3000,localhost:3001,127.0.0.1,127.0.0.1:3000,127.0.0.1:3001,0.0.0.0,192.168.0.208,100.125.255.121,10.1.139.29")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "http", hostname: "**" },
      { protocol: "https", hostname: "**" },
    ],
    // Production: disable Next.js image optimization.
    // We use nginx to directly serve /uploads/ files (runtime uploads).
    // Next.js standalone build does not include public/uploads/, so the
    // _next/image proxy cannot read newly uploaded files at runtime.
    // With unoptimized=true, <Image> outputs a plain <img> tag whose
    // /uploads/ URL is handled by nginx.
    unoptimized: process.env.NODE_ENV === "production",
  },
};

export default nextConfig;
