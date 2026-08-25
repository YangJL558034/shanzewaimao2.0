import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Allow the development server to be opened from phones/tablets on the
  // same network. Production builds are unaffected by this setting.
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS || "localhost,localhost:3000,localhost:3001,127.0.0.1,127.0.0.1:3000,127.0.0.1:3001,0.0.0.0,192.168.0.208,100.125.255.121,10.1.139.29")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
  },
};

export default nextConfig;
