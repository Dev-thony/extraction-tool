import { requireAdminSession } from '../../lib/auth';
import { RecordsTable } from '../../components/records-table';

export default async function RecordsPage() {
  await requireAdminSession();

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Records</h1>
          <p>Search, review, edit and export extracted records.</p>
        </div>
      </div>

      <RecordsTable />
    </div>
  );
}