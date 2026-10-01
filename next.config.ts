import type { NextConfig } from "next";

// Budgeto v2 — 100% client-side (data di IndexedDB + Supabase langsung dari browser).
// Static export → bisa di-host gratis (Vercel/Netlify/Cloudflare Pages)
// dan dibungkus Capacitor jadi APK Android.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
