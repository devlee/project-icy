import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@icy/adapters", "@icy/core", "@icy/shared"],
  serverExternalPackages: ["better-sqlite3"],
  // Local Studio uploads (character anchors); default Server Action limit is 1MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
