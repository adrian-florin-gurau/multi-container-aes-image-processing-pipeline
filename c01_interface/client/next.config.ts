import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Essential for Docker/K8s
};

export default nextConfig;
