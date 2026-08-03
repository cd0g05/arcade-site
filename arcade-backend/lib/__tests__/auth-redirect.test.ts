import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { resolveRedirect } from '../auth-redirect';

const BASE = 'https://dev.cartercripe.com';
const SITE = 'https://arcade.cartercripe.com';
const ADMIN = `${BASE}/arcade/admin`;

describe('resolveRedirect (post-auth landing)', () => {
  // NODE_ENV is typed read-only on ProcessEnv, so it needs a widened view to set.
  const env = process.env as Record<string, string | undefined>;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalOrigins = process.env.CORS_ALLOWED_ORIGINS;
  const originalSuffixes = process.env.CORS_ALLOWED_ORIGIN_SUFFIXES;

  beforeEach(() => {
    // isAllowedOrigin adds localhost in non-production; pin production so these assertions
    // are about the allow-list itself and not the dev convenience entries.
    env['NODE_ENV'] = 'production';
    delete process.env.CORS_ALLOWED_ORIGINS;
    delete process.env.CORS_ALLOWED_ORIGIN_SUFFIXES;
  });

  afterEach(() => {
    env['NODE_ENV'] = originalNodeEnv;
    if (originalOrigins === undefined) delete process.env.CORS_ALLOWED_ORIGINS;
    else process.env.CORS_ALLOWED_ORIGINS = originalOrigins;
    if (originalSuffixes === undefined) delete process.env.CORS_ALLOWED_ORIGIN_SUFFIXES;
    else process.env.CORS_ALLOWED_ORIGIN_SUFFIXES = originalSuffixes;
  });

  it('sends a player back to the arcade site, which is a different origin', () => {
    expect(resolveRedirect(`${SITE}/`, BASE)).toBe(`${SITE}/`);
    expect(resolveRedirect(`${SITE}/account/`, BASE)).toBe(`${SITE}/account/`);
  });

  it('replaces the host root with the admin dashboard rather than a 404', () => {
    // Auth.js's own default when no callbackUrl is given. Nothing is served at this
    // host's root — the whole service lives under /arcade — so honouring it strands the
    // user on an error page, which is the bug this function exists to fix.
    expect(resolveRedirect(BASE, BASE)).toBe(ADMIN);
    expect(resolveRedirect(`${BASE}/`, BASE)).toBe(ADMIN);
    expect(resolveRedirect('/', BASE)).toBe(ADMIN);
  });

  it('keeps a real path on this host', () => {
    expect(resolveRedirect('/arcade/admin/users', BASE)).toBe(`${BASE}/arcade/admin/users`);
    expect(resolveRedirect(`${BASE}/arcade/admin/games`, BASE)).toBe(`${BASE}/arcade/admin/games`);
  });

  it('refuses to redirect off-site', () => {
    // callbackUrl is attacker-controllable and reachable before authentication, so an
    // unchecked value here is an open redirect usable for credential phishing.
    expect(resolveRedirect('https://evil.example.com/phish', BASE)).toBe(ADMIN);
    // Suffix-style lookalike: must not be admitted by a careless endsWith check.
    expect(resolveRedirect('https://arcade.cartercripe.com.evil.example.com/', BASE)).toBe(ADMIN);
    expect(resolveRedirect('not a url', BASE)).toBe(ADMIN);
  });

  it('honours an extra configured origin but not an arbitrary one', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://staging.cartercripe.com';
    expect(resolveRedirect('https://staging.cartercripe.com/x', BASE)).toBe(
      'https://staging.cartercripe.com/x',
    );
    expect(resolveRedirect('https://other.cartercripe.com/x', BASE)).toBe(ADMIN);
  });
});
