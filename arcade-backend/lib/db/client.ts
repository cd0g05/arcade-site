import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// No dotenv here: Next.js loads `.env*` itself, and bundling dotenv into app code
// made it resolve a bogus path during `next build`. Non-Next entrypoints (tsx
// scripts, Vitest) load env via `lib/load-env.ts` before importing this module.
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
}

// neon-http (not the WebSocket pool driver) is used deliberately: Vercel Functions
// (Fluid Compute) instances are reused across concurrent requests, and the stateless
// HTTP driver avoids the connection-exhaustion risk flagged in tech-design.md's
// Implementation Sequence ("Known implementation risks") without needing a separate
// pooler. Revisit only if a future partition needs transactions spanning multiple
// round-trips that neon-http can't express in one query.
const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });
