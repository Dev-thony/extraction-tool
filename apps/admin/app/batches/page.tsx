import { BatchesTable } from '../../components/batches-table';
import { requireAdminSession } from '../../lib/auth';

export default async function BatchesPage() {
  await requireAdminSession();

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Extraction Batches</h1>
          <p>Monitor uploads, processing progress, review items and failures.</p>
        </div>
      </div>

      <BatchesTable />
    </div>
  );
}
