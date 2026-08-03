'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/arcade/admin/users', label: 'Users' },
  { href: '/arcade/admin/games', label: 'Games' },
  { href: '/arcade/admin/leaderboards', label: 'Leaderboards' },
  { href: '/arcade/admin/bot-log', label: 'Bot Log' },
  { href: '/arcade/admin/analytics', label: 'Analytics' },
] as const;

/** Sidebar nav from UX Mock-Up 1. A client component only so it can mark the active item. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <>
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-item${pathname.startsWith(item.href) ? ' active' : ''}`}
          aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}
