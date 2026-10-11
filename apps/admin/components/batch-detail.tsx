'use client';

import { useCallback, useEffect, useState } from 'react';

interface BatchItem {
  id: string;
  status: string;
  filename: string | null;
  source: string;
  attempts: number;
  error: string | null;
  recordIds: string[];
  createdAt: string;
  completedAt: string | null;
}

interface Batch {
  id: string;
  name: string | null;
  source: string;
  status: string;
  totalItems: number;
  queuedItems: number;
  processingItems: number;
  completedItems: number;
  failedItems: number;
  reviewItems: number;
  createdAt: string;
  items: BatchItem[];
}

interface CreatedRecord {
  id: string;
  fullName: string | null;
  email: string | null;
  phoneNumber: string | null;
  status: string;
}

interface DetailResponse {
  batch: Batch;
  records: CreatedRecord[];
}

export function BatchDetail({ batchId }: { batchId: string }) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/batches/${batchId}`, {
        cache: 'no-store',
      });

      if (!response.ok) throw new Error('Could not load batch details.');

      setData(await response.json());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load batch details.');
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!data || !['PROCESSING', 'QUEUED'].includes(data.batch.status)) {
      return;
    }

    const timer = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [data, refresh]);

  async function performAction(action: 'retry' | 'cancel') {
    if (action === 'cancel') {
      const confirmed = window.confirm('Cancel the queued items in this batch?');
      if (!confirmed) return;
    }

    setBusy(true);
    setNotice('');
    setError('');

    try {
      const response = await fetch(`/api/batches/${batchId}/${action}`, { method: 'POST' });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Action failed.');
      }

      setNotice(result.message || 'Action completed.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function processQueue() {
    setBusy(true);
    setNotice('');
    setError('');

    try {
      const response = await fetch(`/api/batches/${batchId}/process`, { method: 'POST' });

      const result = await response.json().catch(() => null);

      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || 'Could not process the next queued item.');
      }

      setNotice(result?.message || (result?.done ? 'No queued items remain.' : 'Processing request completed.'));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process the next item.');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p>Loading batch...</p>;
  if (!data) return <p className="batch-error">{error || 'Batch not found.'}</p>;

  const { batch, records } = data;
  const progress =
    batch.totalItems > 0 ? Math.round((batch.completedItems / batch.totalItems) * 100) : 0;

  return (
    <div className="batch-detail-page">
      <div className="admin-page-header">
        <div>
          <a href="/batches" className="back-link">
            ← All batches
          </a>
          <h1>{batch.name || `Batch ${batch.id.slice(0, 8)}`}</h1>
          <p>
            {batch.source.replace('_', ' ')} · Created {new Date(batch.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="batch-detail-actions">
          <button className="admin-button secondary" disabled={busy} onClick={() => void refresh()}>
            Refresh
          </button>

          {(batch.queuedItems > 0 || batch.status === 'QUEUED') && (
            <button
              className="admin-button primary"
              disabled={busy}
              onClick={() => void processQueue()}
            >
              {busy ? 'Working...' : 'Process Queue'}
            </button>
          )}

          {batch.failedItems > 0 && (
            <button
              className="admin-button secondary"
              disabled={busy}
              onClick={() => void performAction('retry')}
            >
              Retry Failed
            </button>
          )}

          {['QUEUED', 'PROCESSING'].includes(batch.status) && (
            <button
              className="admin-button danger"
              disabled={busy || batch.processingItems > 0}
              onClick={() => void performAction('cancel')}
              title={
                batch.processingItems > 0 ? 'Wait for the active item to finish first.' : undefined
              }
            >
              Cancel Queue
            </button>
          )}
        </div>
      </div>

      {notice && <p className="batch-notice">{notice}</p>}
      {error && <p className="batch-error">{error}</p>}

      <div className="batch-stat-grid">
        <div className="batch-stat-card">
          <span>Total files</span>
          <strong>{batch.totalItems}</strong>
        </div>
        <div className="batch-stat-card">
          <span>Completed</span>
          <strong>{batch.completedItems}</strong>
        </div>
        <div className="batch-stat-card">
          <span>Queued / processing</span>
          <strong>{batch.queuedItems + batch.processingItems}</strong>
        </div>
        <div className="batch-stat-card">
          <span>Needs review</span>
          <strong>{batch.reviewItems}</strong>
        </div>
        <div className="batch-stat-card">
          <span>Failed</span>
          <strong>{batch.failedItems}</strong>
        </div>
      </div>

      <section className="batch-panel">
        <div className="batch-panel-heading">
          <h2>Overall progress</h2>
          <strong>{progress}%</strong>
        </div>
        <div className="batch-progress-track batch-progress-large">
          <div className="batch-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </section>

      <section className="batch-panel">
        <h2>Files in this batch</h2>

        <div className="admin-table-wrapper">
          <table className="admin-table batch-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Error details</th>
                <th>Finished</th>
              </tr>
            </thead>
            <tbody>
              {batch.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.filename || item.id}</td>
                  <td>
                    <span className={`status-badge status-${item.status.toLowerCase()}`}>
                      {item.status.replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td>{item.attempts}</td>
                  <td className="batch-error-cell">{item.error || '—'}</td>
                  <td>{item.completedAt ? new Date(item.completedAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
              {batch.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty">
                    This batch contains no items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="batch-panel">
        <h2>Records created by this batch</h2>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.fullName || 'Unnamed'}</td>
                  <td>{record.email || '—'}</td>
                  <td>{record.phoneNumber || '—'}</td>
                  <td>{record.status}</td>
                  <td>
                    <a className="record-link" href={`/records/${record.id}`}>
                      View record
                    </a>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty">
                    No records have been created by this batch yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
