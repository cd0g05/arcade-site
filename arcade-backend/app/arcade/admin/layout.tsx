import type { ReactNode } from 'react';
import { getAdminSession } from '@/lib/admin-guard';
import { AdminNav } from './AdminNav';
import './admin.css';

export const metadata = { title: 'Arcade Admin' };

// Every admin page reads live ledger state, so none of this may be prerendered or cached.
export const dynamic = 'force-dynamic';

/**
 * Shared `/admin` shell and auth gate (tasks.md id:60).
 *
 * The guard lives in the layout rather than in each page so a new admin page cannot ship
 * unprotected by omission — an unguarded page would have to be placed outside this
 * segment on purpose.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();

  if (!session) {
    // 403 rather than a redirect to sign-in: a signed-in non-admin has nothing to gain
    // from authenticating again, and the response deliberately does not distinguish
    // "not signed in" from "not an admin".
    return (
      <p className="forbidden">
        403 — Admin access required.
      </p>
    );
  }

  return (
    <div className="shell">
      <nav className="sidebar">
        <h1>
          ARCADE
          <br />
          ADMIN
        </h1>
        <AdminNav />
      </nav>
      <main>{children}</main>
    </div>
  );
}
