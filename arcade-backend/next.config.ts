import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Deployed as its own Vercel project via Root Directory = arcade-backend/
  // (Tech Design ADR-1) — no rewrites/proxying to the static arcade site needed;
  // the site calls this service's API directly, CORS-allow-listed (see lib/cors.ts).
};

export default nextConfig;
