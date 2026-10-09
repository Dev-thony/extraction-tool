import { redirect } from 'next/navigation';
import { getAdminSession } from '../lib/auth';
import { DashboardContent } from '../components/dashboard-content';

export default async function AdminDashboard() {
  const session = await getAdminSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <main className="admin-content">
      <div style={{ marginBottom: 30 }}>
        <p
          style={{
            margin: 0,
            color: '#64748b',
            fontSize: 14,
          }}
        >
          Welcome back
        </p>

        <h1
          style={{
            margin: '6px 0 0',
            fontSize: 32,
          }}
        >
          Dashboard
        </h1>
      </div>

      <DashboardContent />
    </main>
  );
}
