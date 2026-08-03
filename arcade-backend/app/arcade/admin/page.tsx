import { redirect } from 'next/navigation';

/** `/admin` lands on the Users list, the dashboard's primary surface (UX Mock-Up 1). */
export default function AdminIndex() {
  redirect('/arcade/admin/users');
}
