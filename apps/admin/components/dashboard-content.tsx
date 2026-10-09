'use client';

import { useEffect, useState } from 'react';

interface DashboardStats {
  totalRecords: number;
  recordsToday: number;
  pendingReview: number;
  processed: number;
  failed: number;
  averageConfidence: number | null;
}

const cards = [
  {
    key: 'totalRecords',
    label: 'Total Records',
  },
  {
    key: 'recordsToday',
    label: 'Records Today',
  },
  {
    key: 'pendingReview',
    label: 'Pending Review',
  },
  {
    key: 'processed',
    label: 'Processed',
  },
  {
    key: 'failed',
    label: 'Failed OCR',
  },
] as const;

export function DashboardContent() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch('/api/dashboard');

        if (!response.ok) {
          throw new Error('Unable to load dashboard.');
        }

        const data = await response.json();

        setStats(data);
      } catch (err) {
        console.error(err);
        setError('Unable to load dashboard statistics.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  return (
    <div>
      {error && (
        <div
          style={{
            marginBottom: 20,
            padding: 14,
            borderRadius: 10,
            background: '#fef2f2',
            color: '#b91c1c',
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        {cards.map((card) => (
          <div
            key={card.key}
            className="card"
            style={{
              padding: 22,
            }}
          >
            <div
              style={{
                color: '#64748b',
                fontSize: 14,
              }}
            >
              {card.label}
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              {loading ? '...' : (stats?.[card.key] ?? 0)}
            </div>
          </div>
        ))}

        <div
          className="card"
          style={{
            padding: 22,
          }}
        >
          <div
            style={{
              color: '#64748b',
              fontSize: 14,
            }}
          >
            Average Confidence
          </div>

          <div
            style={{
              marginTop: 10,
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            {loading
              ? '...'
              : stats?.averageConfidence == null
                ? '—'
                : `${Math.round(stats.averageConfidence * 100)}%`}
          </div>
        </div>
      </div>
    </div>
  );
}
