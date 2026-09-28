import type { NextConfig } from "next";

// Where the NestJS API runs. The browser never calls it directly: every
// `/api/*` request goes to this app's own origin and is forwarded here, so
// the auth cookie stays first-party.
const apiUrl = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // Don't generate AGENTS.md / CLAUDE.md on `next dev`.
  agentRules: false,

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
