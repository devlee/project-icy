import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@icy/core", "@icy/shared"],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
