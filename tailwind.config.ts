import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#07152d",
        brand: { 50: "#eff6ff", 100: "#dbeafe", 500: "#1263e6", 600: "#0755d6", 700: "#0648b5", 950: "#07182e" },
      },
      boxShadow: {
        soft: "0 12px 35px rgba(14,43,83,.09)",
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
