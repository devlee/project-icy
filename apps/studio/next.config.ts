import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@icy/adapters", "@icy/core", "@icy/shared"],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
