/**
 * Loads `.env.local` for entrypoints that run OUTSIDE the Next.js runtime —
 * `tsx` scripts (`lib/db/migrate.ts`, `scripts/seed.ts`), `drizzle.config.ts`,
 * and Vitest (via `setupFiles` in `vitest.config.ts`).
 *
 * Import this as the FIRST import in such an entrypoint, before anything that
 * reaches `lib/db/client.ts` — that module throws on a missing `DATABASE_URL`
 * at import time, and ESM evaluates imports in source order.
 *
 * Application code must NOT import this. Next.js loads `.env*` files itself, and
 * bundling `dotenv` into the app made it resolve a nonsense path at build time
 * (`injected env (0) from ../../../../ROOT/arcade-backend/.env.local`).
 *
 * Anchored on `process.cwd()` rather than `__dirname` because it must behave the
 * same under tsx (CJS) and Vitest (ESM, where `__dirname` is absent). Every
 * consumer is launched from the project root via an npm script.
 */
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
