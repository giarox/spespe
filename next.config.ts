import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "imgproxy.leaflets.schwarz",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "media.leaflets.schwarz",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
