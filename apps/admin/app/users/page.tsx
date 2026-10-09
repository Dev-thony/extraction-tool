import { redirect } from 'next/navigation';

import { getAdminSession } from '../../lib/auth';
import { UsersManagement } from '../../components/users-management';

export default async function UsersPage() {
  const session = await getAdminSession();

  if (!session) {
    redirect('/login');
  }

  if (session.role !== 'ADMIN') {
    redirect('/');
  }

  return (
    <main className="admin-page">
      <UsersManagement currentUserId={session.userId} currentUserRole={session.role} />
    </main>
  );
}
