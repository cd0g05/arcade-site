import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Deployed as its own Vercel project via Root Directory = arcade-backend/
  // (Tech Design ADR-1) — no rewrites/proxying to the static arcade site needed;
  // the site calls this service's API directly, CORS-allow-listed (see lib/cors.ts).

  // NOTE: deliberately NO `basePath: '/arcade'` here, even though this service is served
  // at dev.cartercripe.com/arcade. The /arcade prefix is a real route segment
  // (app/arcade/**) instead.
  //
  // basePath looks like the obvious tool and quietly breaks OAuth. Next strips the
  // prefix before a route handler sees the request, so Auth.js builds its callback URLs
  // from a path with no /arcade in it and sends Google
  // `redirect_uri=https://dev.cartercripe.com/api/auth/callback/google` — a URL this
  // deployment does not serve. Setting AUTH_URL to the prefixed path to compensate makes
  // it worse: Auth.js then expects to match `/arcade/api/auth/*` against the already
  // stripped `/api/auth/*` and every auth route returns 400.
  //
  // Both were verified against a running server. With a real route segment the handler
  // sees the true path and the redirect_uri comes out correct.
};

export default nextConfig;
