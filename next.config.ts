import type { NextConfig } from "next";

// Budgeto v3 — 100% client-side (data di IndexedDB + Supabase langsung dari browser).
// Static export → bisa di-host gratis (Vercel/Netlify/Cloudflare Pages)
// dan dibungkus Capacitor jadi APK Android (webDir: "out").
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
