/**
 * Spike (tasks.md id:4): verifies the Neon driver does not exhaust connections when a
 * single warm Vercel Fluid Compute instance serves many concurrent requests off one
 * module-scope client. Re-run this if the driver or Neon plan changes.
 *
 *   npx tsx scripts/spike-neon-pooling.ts
 *
 * Findings are recorded in tech-design.md "Spike result: Neon pooling under Fluid Compute".
 */
import '../lib/load-env';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL!;
const sql = neon(url);

async function burst(label: string, n: number) {
  const t0 = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: n }, (_, i) => sql`select ${i}::int as i, pg_backend_pid() as pid`)
  );
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected');
  const pids = new Set(
    results.flatMap((r) => (r.status === 'fulfilled' ? [(r.value as any)[0].pid] : []))
  );
  console.log(`${label}: ${ok}/${n} ok, ${failed.length} failed, ${pids.size} distinct backend pids, ${Date.now() - t0}ms`);
  if (failed.length) console.log('  first error:', (failed[0] as PromiseRejectedResult).reason?.message);
  return { ok, failed: failed.length };
}

async function main() {
  console.log('endpoint pooled:', url.includes('-pooler') ? 'YES (PgBouncer)' : 'no (direct)');
  const limit = await sql`show max_connections`;
  console.log('max_connections:', (limit as any)[0].max_connections);

  // Simulate Fluid Compute: one warm instance serving many concurrent requests
  // off a single module-scope neon() client.
  const r1 = await burst('burst A (25 concurrent)', 25);
  const r2 = await burst('burst B (50 concurrent)', 50);
  const r3 = await burst('burst C (100 concurrent)', 100);

  // Sequential reuse across "invocations" on the same warm client.
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) await sql`select 1`;
  console.log(`sequential reuse (20 queries on same client): ${Date.now() - t0}ms`);

  const active = await sql`select count(*)::int as c from pg_stat_activity where datname = current_database()`;
  console.log('backends still attributed to this database after bursts:', (active as any)[0].c);

  const totalFailed = r1.failed + r2.failed + r3.failed;
  console.log(totalFailed === 0 ? '\nRESULT: PASS — no connection exhaustion under 175 concurrent queries.' : `\nRESULT: FAIL — ${totalFailed} query failures.`);
  process.exit(totalFailed === 0 ? 0 : 1);
}
main();
