import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@extraction/db';
import { getAdminSession } from '../../../lib/auth';
import { RecordEditor } from '../../../components/record-editor';

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function RecordDetailsPage({ params }: Props) {
  const session = await getAdminSession();

  if (!session) {
    redirect('/login');
  }

  const { id } = await params;

  const record = await prisma.record.findUnique({
    where: {
      id,
    },
    include: {
      logs: {
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  if (!record) {
    notFound();
  }

  return (
    <main className="admin-content">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Link
          href="/records"
          style={{
            color: '#047857',
            fontWeight: 600,
          }}
        >
          ← Records
        </Link>

        <span style={{ color: '#cbd5e1' }}>/</span>

        <span
          style={{
            color: '#64748b',
            fontSize: 14,
          }}
        >
          {record.fullName || record.id}
        </span>
      </div>

      <div style={{ marginBottom: 26 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 32,
          }}
        >
          Record Details
        </h1>

        <p
          style={{
            marginTop: 8,
            color: '#64748b',
          }}
        >
          Review and edit the extracted information.
        </p>
      </div>

      <RecordEditor
        record={{
          id: record.id,
          imageUrl: record.imageUrl,
          fullName: record.fullName,
          userName: record.userName,
          email: record.email,
          phoneNumber: record.phoneNumber,
          pukNumber: record.pukNumber,
          confidence: record.confidence,
          fieldConfidences: record.fieldConfidences,
          rawOCR: record.rawOCR,
          status: record.status,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
          logs: record.logs.map((log) => ({
            id: log.id,
            event: log.event,
            level: log.level,
            message: log.message,
            meta: log.meta,
            createdAt: log.createdAt.toISOString(),
          })),
        }}
      />
    </main>
  );
}
