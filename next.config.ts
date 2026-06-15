import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions only emit Inngest events; the heavy work runs in Inngest functions.
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    // Generated media is served from Supabase Storage signed URLs.
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
};

export default nextConfig;
