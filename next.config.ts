import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel & Netlify auto-detect Next.js – no output setting needed.
  // For self-hosting with `next start`, uncomment:
  // output: 'standalone',

  serverExternalPackages: [
    // Native add-ons – must run in Node.js, not in the edge runtime.
    'better-sqlite3',
    'pg-native',
  ],

  webpack(config, { isServer }) {
    if (isServer) {
      // Tell webpack not to try to bundle these native modules;
      // they will be loaded from node_modules at runtime.
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        'better-sqlite3',
        'pg-native',
      ];
    }
    return config;
  },
};

export default nextConfig;
