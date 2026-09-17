import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/yonetim/hesap", destination: "/yonetim/adisyon", permanent: false },
      { source: "/yonetim/hesap/:path*", destination: "/yonetim/adisyon/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
