import Link from 'next/link';
import {
  listUsersWithBalances,
  listUserTransactions,
  getUserWithBalance,
  type TransactionSort,
} from '@/lib/admin';
import { BalanceAdjuster } from './BalanceAdjuster';

const SORTS: Array<{ key: TransactionSort; label: string }> = [
  { key: 'time', label: 'Time' },
  { key: 'amount', label: 'Amount' },
  { key: 'reason', label: 'Reason' },
];

function amountClass(amount: number) {
  if (amount > 0) return 'amt-pos';
  if (amount < 0) return 'amt-neg';
  return 'amt-neutral';
}

function formatDate(d: Date) {
  return new Date(d).toISOString().slice(0, 10);
}

function formatTime(d: Date) {
  return new Date(d).toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * Users list + transaction drill-down (tasks.md ids 61, 62), per UX Mock-Up 1.
 *
 * The drill-down is selected by search param on the same route rather than a nested
 * `/admin/users/[id]` page, which is what makes "clicking a row renders the log inline
 * without a full page navigation" true: `<Link>` does a client-side transition and only
 * the changed panel re-renders.
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const users = await listUsersWithBalances();

  const selectedId = params.user ?? users[0]?.id;
  const sort: TransactionSort = SORTS.some((s) => s.key === params.sort)
    ? (params.sort as TransactionSort)
    : 'time';

  const selected = selectedId ? await getUserWithBalance(selectedId) : null;
  const transactions = selected ? await listUserTransactions(selected.id, sort) : [];

  return (
    <div className="layout">
      <section className="panel">
        <h2 className="panel-heading">Users</h2>
        {users.length === 0 ? (
          <p className="empty">No users yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Balance</th>
                <th>Last Active</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className={user.id === selectedId ? 'selected row-link' : 'row-link'}
                >
                  <td>
                    <Link href={`/admin/users?user=${user.id}`}>{user.displayName}</Link>
                  </td>
                  <td className="balance">{user.balance}</td>
                  <td>{formatDate(user.lastActiveAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        {!selected ? (
          <p className="empty">Select a user to see their transaction log.</p>
        ) : (
          <>
            <div className="drilldown-header">
              <h2 className="panel-heading" style={{ margin: 0 }}>
                {selected.displayName} — Transaction Log
              </h2>
              <BalanceAdjuster userId={selected.id} balance={selected.balance} />
            </div>

            {transactions.length === 0 ? (
              <p className="empty">No activity yet</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    {SORTS.map((s) => (
                      <th key={s.key}>
                        <Link
                          href={`/admin/users?user=${selected.id}&sort=${s.key}`}
                          className={`sort-link${sort === s.key ? ' active' : ''}`}
                        >
                          {s.label}
                        </Link>
                      </th>
                    ))}
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td>{formatTime(t.createdAt)}</td>
                      <td className={amountClass(t.amount)}>
                        {t.amount > 0 ? `+${t.amount}` : t.amount}
                      </td>
                      <td>{t.reason}</td>
                      <td>{t.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>
    </div>
  );
}
