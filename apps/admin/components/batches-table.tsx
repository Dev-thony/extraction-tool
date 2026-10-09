'use client';

import { useCallback, useEffect, useState } from 'react';

interface Batch {
  id: string;
  name: string | null;
  source: 'LOCAL' | 'ZIP' | 'GOOGLE_DRIVE';
  status: string;
  totalItems: number;
  queuedItems: number;
  processingItems: number;
  completedItems: number;
  failedItems: number;
  reviewItems: number;
  createdAt: string;
}

interface BatchResponse {
  items: Batch[];
  total: number;
  page: number;
  totalPages: number;
}

export function BatchesTable() {
  const [data, setData] = useState<BatchResponse | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBatches = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
      });

      if (status) params.set('status', status);
      if (search.trim()) params.set('search', search.trim());

      const response = await fetch(`/api/batches?${params}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Could not load batches.');
      }

      setData(await response.json());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load batches.');
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  // Refresh while any listed batch is active.
  useEffect(() => {
    if (!data?.items.some((batch) => batch.status === 'PROCESSING')) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadBatches();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [data, loadBatches]);

  return (
    <section className="batch-list">
      <div className="batch-filters">
        <input
          value={search}
          placeholder="Search batch name..."
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />

        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="QUEUED">Queued</option>
          <option value="PROCESSING">Processing</option>
          <option value="COMPLETED">Completed</option>
          <option value="COMPLETED_WITH_ERRORS">Completed with errors</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <button className="admin-button secondary" type="button" onClick={() => void loadBatches()}>
          Refresh
        </button>
      </div>

      {error && <p className="batch-error">{error}</p>}

      <div className="admin-table-card">
        <div className="admin-table-wrapper">
          <table className="admin-table batch-table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Source</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Review</th>
                <th>Failed</th>
                <th>Created</th>
              </tr>
            </thead>

            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={7} className="table-empty">
                    Loading batches...
                  </td>
                </tr>
              ) : data?.items.length ? (
                data.items.map((batch) => {
                  const progress =
                    batch.totalItems > 0
                      ? Math.round((batch.completedItems / batch.totalItems) * 100)
                      : 0;

                  return (
                    <tr key={batch.id}>
                      <td>
                        <a className="record-link" href={`/batches/${batch.id}`}>
                          {batch.name || `Batch ${batch.id.slice(0, 8)}`}
                        </a>
                        <div className="batch-subtitle">{batch.totalItems} files</div>
                      </td>

                      <td>{batch.source.replace('_', ' ')}</td>

                      <td>
                        <span className={`status-badge status-${batch.status.toLowerCase()}`}>
                          {batch.status.replaceAll('_', ' ')}
                        </span>
                      </td>

                      <td>
                        <div className="batch-progress">
                          <div className="batch-progress-track">
                            <div
                              className="batch-progress-fill"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <small>
                            {progress}% · {batch.completedItems}/{batch.totalItems}
                          </small>
                        </div>
                      </td>

                      <td>{batch.reviewItems}</td>
                      <td>{batch.failedItems}</td>
                      <td>{new Date(batch.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="table-empty">
                    No batches found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="pagination">
            <span>{data.total} batches</span>
            <div>
              <button
                className="admin-button secondary"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>
              <span className="pagination-page">
                Page {data.page} of {Math.max(1, data.totalPages)}
              </span>
              <button
                className="admin-button secondary"
                disabled={page >= data.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
