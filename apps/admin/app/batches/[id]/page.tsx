import { requireAdminSession } from '../../../lib/auth';
import { BatchDetail } from '../../../components/batch-detail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BatchDetailPage({ params }: PageProps) {
  await requireAdminSession();
  const { id } = await params;

  return <BatchDetail batchId={id} />;
}
