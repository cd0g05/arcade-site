/**
 * CORS allow-listing for browser-originated requests (tasks.md id:50).
 *
 * Only the arcade site's own origins may call this API from a browser. Bot calls are
 * server-to-server and never send an `Origin` header, so they are unaffected by anything
 * here — the bot's gate is the service API key in lib/api-auth.ts, not CORS.
 *
 * Deliberately an explicit allow-list rather than reflecting whatever `Origin` arrives:
 * these routes are cookie-authenticated, so a reflect-any policy combined with
 * `Access-Control-Allow-Credentials` would let any site on the internet make authenticated
 * requests as the logged-in user.
 */

/** Production origin of the static arcade site. */
const DEFAULT_ALLOWED = ['https://arcade.cartercripe.com'];

/**
 * Preview deploys get fresh hostnames per deployment, so they cannot be enumerated in a
 * static list. Configure a host suffix (e.g. `.vercel.app`) to admit them.
 */
function previewSuffixes(): string[] {
  return (process.env.CORS_ALLOWED_ORIGIN_SUFFIXES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function exactAllowed(): string[] {
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Local dev: the arcade site runs on Vite's default port.
  const dev =
    process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:5173', 'http://127.0.0.1:5173'];

  return [...DEFAULT_ALLOWED, ...configured, ...dev];
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (exactAllowed().includes(origin)) return true;

  let host: string;
  let protocol: string;
  try {
    ({ host, protocol } = new URL(origin));
  } catch {
    return false;
  }
  if (protocol !== 'https:') return false;

  // Match on a dot boundary: a bare `endsWith('.vercel.app')` check without this would
  // also admit `evil-arcade.vercel.app.attacker.com`-style hosts if the suffix were ever
  // configured without a leading dot.
  return previewSuffixes().some((suffix) => {
    const normalized = suffix.startsWith('.') ? suffix : `.${suffix}`;
    return host.endsWith(normalized);
  });
}

/**
 * Headers to merge into a response. Returns an empty object for a disallowed or absent
 * origin — the browser then blocks the response for a cross-origin caller, while
 * same-origin and server-to-server callers are unaffected.
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!isAllowedOrigin(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin as string,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    // Responses vary by Origin, so a shared cache must not serve one origin's
    // response (with its allow header) to another.
    Vary: 'Origin',
  };
}

/** Shared preflight handler — re-exported as `OPTIONS` by every route. */
export function handlePreflight(req: Request): Response {
  const headers = corsHeaders(req.headers.get('origin'));
  return new Response(null, {
    status: Object.keys(headers).length > 0 ? 204 : 403,
    headers,
  });
}
