import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL || "http://localhost:3008";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${backendUrl}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
