import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // There is a stray package-lock.json in the home directory, so Turbopack infers
  // ~ as the workspace root and refuses it. Pin the root to this project.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
