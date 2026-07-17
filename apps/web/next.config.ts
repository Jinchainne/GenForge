import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@genforge/domain",
    "@genforge/evidence",
    "@genforge/rules",
    "@genforge/github-adapter",
    "@genforge/reports",
  ],
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
};

export default nextConfig;
