'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ExtractionRecord, ProcessingStatus, RecordSortField } from '@extraction/types';

import { exportRecords } from '../lib/export-records';
import { toTitleCaseName } from '@extraction/core/name-format';

interface RecordsResponse {
  items: ExtractionRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const STATUS_OPTIONS: Array<ProcessingStatus | ''> = [
  '',
  'PENDING',
  'PROCESSING',
  'NEEDS_REVIEW',
  'PROCESSED',
  'FAILED',
];

const SORT_FIELDS: Array<{
  key: RecordSortField;
  label: string;
}> = [
  {
    key: 'fullName',
    label: 'Full Name',
  },
  {
    key: 'userName',
    label: 'Partnership',
  },
  {
    key: 'email',
    label: 'Email',
  },
  {
    key: 'phoneNumber',
    label: 'Phone',
  },
  {
    key: 'pukNumber',
    label: 'PUK',
  },
  {
    key: 'createdAt',
    label: 'Upload Date',
  },
  {
    key: 'confidence',
    label: 'Confidence',
  },
];

export function RecordsTable() {
  const [data, setData] = useState<RecordsResponse | null>(null);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');

  const [status, setStatus] = useState<ProcessingStatus | ''>('');

  const [alphaFilter, setAlphaFilter] = useState('');

  const [dateFrom, setDateFrom] = useState('');

  const [dateTo, setDateTo] = useState('');

  const [page, setPage] = useState(1);

  const [sortBy, setSortBy] = useState<RecordSortField>('createdAt');

  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [toast, setToast] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);

  const [deleting, setDeleting] = useState(false);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: status || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sortBy,
      sortDir,
    }),
    [search, status, dateFrom, dateTo, sortBy, sortDir],
  );

  const loadRecords = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      params.set('page', String(page));
      params.set('pageSize', '20');
      params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);
      if (alphaFilter) params.set('firstLetter', alphaFilter);

      if (search.trim()) {
        params.set('search', search.trim());
      }

      if (status) {
        params.set('status', status);
      }

      if (dateFrom) {
        params.set('dateFrom', dateFrom);
      }

      if (dateTo) {
        params.set('dateTo', dateTo);
      }

      const response = await fetch(`/api/records?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to load records.');
      }

      const result = (await response.json()) as RecordsResponse;

      setData(result);
    } catch (error) {
      console.error(error);

      setToast('Unable to load records.');
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortDir, search, status, dateFrom, dateTo, alphaFilter]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => setToast(null), 3000);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  const currentPageIds = useMemo(() => data?.items.map((record) => record.id) ?? [], [data]);

  const allCurrentPageSelected =
    currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id));

  function toggleSelection(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function toggleCurrentPage() {
    setSelectedIds((previous) => {
      const next = new Set(previous);

      if (allCurrentPageSelected) {
        currentPageIds.forEach((id) => next.delete(id));
      } else {
        currentPageIds.forEach((id) => next.add(id));
      }

      return next;
    });
  }

  function changeSort(field: RecordSortField) {
    setPage(1);

    if (sortBy === field) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(field);
    setSortDir('asc');
  }

  function resetFilters() {
    setSearch('');
    setStatus('');
    setAlphaFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }

  async function handleExport(scope: 'selected' | 'filtered' | 'all', format: 'xlsx' | 'csv') {
    if (scope === 'selected' && selectedIds.size === 0) {
      setToast('Select at least one record first.');
      return;
    }

    setExporting(true);

    try {
      await exportRecords({
        format,
        scope,
        ids: scope === 'selected' ? Array.from(selectedIds) : undefined,
        filters: scope === 'selected' ? undefined : filters,
      });

      setToast(`Exported records as ${format.toUpperCase()}.`);
    } catch (error) {
      console.error(error);

      setToast(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteSelected() {
    const ids = Array.from(selectedIds);

    if (ids.length === 0) {
      setToast('Select at least one record first.');
      return;
    }

    const confirmed = window.confirm(
      `Delete ${ids.length} selected record${ids.length === 1 ? '' : 's'}? This cannot be undone.`,
    );

    if (!confirmed) return;

    setDeleting(true);

    try {
      const response = await fetch('/api/records', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete records.');
      }

      setSelectedIds(new Set());

      setToast(`${ids.length} record${ids.length === 1 ? '' : 's'} deleted.`);

      await loadRecords();
    } catch (error) {
      console.error(error);

      setToast('Unable to delete selected records.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="records-page">
      {toast && <div className="admin-toast">{toast}</div>}

      <div className="records-toolbar">
        <div className="records-search">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search name, email, phone, PUK..."
          />
        </div>

        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as ProcessingStatus | '');
            setPage(1);
          }}
        >
          <option value="">All statuses</option>

          {STATUS_OPTIONS.filter(Boolean).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter names by first letter"
          value={alphaFilter}
          onChange={(event) => { setAlphaFilter(event.target.value); setPage(1); }}
        >
          <option value="">All letters</option>
          {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map((letter) => (
            <option key={letter} value={letter}>{letter}</option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(event) => {
            setDateFrom(event.target.value);
            setPage(1);
          }}
        />

        <input
          type="date"
          value={dateTo}
          onChange={(event) => {
            setDateTo(event.target.value);
            setPage(1);
          }}
        />

        <button type="button" className="admin-button secondary" onClick={resetFilters}>
          Reset
        </button>
      </div>

      <div className="records-actions">
        <div>
          <strong>{selectedIds.size}</strong> selected
        </div>

        <div className="records-action-group">
          <button
            type="button"
            className="admin-button danger"
            disabled={deleting || selectedIds.size === 0}
            onClick={handleDeleteSelected}
          >
            {deleting ? 'Deleting...' : 'Delete Selected'}
          </button>

          <button
            type="button"
            className="admin-button secondary"
            disabled={exporting || selectedIds.size === 0}
            onClick={() => void handleExport('selected', 'xlsx')}
          >
            Export Selected
          </button>

          <button
            type="button"
            className="admin-button secondary"
            disabled={exporting}
            onClick={() => void handleExport('filtered', 'xlsx')}
          >
            Export Filtered
          </button>

          <button
            type="button"
            className="admin-button primary"
            disabled={exporting}
            onClick={() => void handleExport('all', 'xlsx')}
          >
            Export All
          </button>
        </div>
      </div>

      <div className="records-export-row">
        <span>Export format:</span>

        <button
          type="button"
          className="admin-link-button"
          disabled={exporting || selectedIds.size === 0}
          onClick={() => void handleExport('selected', 'csv')}
        >
          Selected CSV
        </button>

        <button
          type="button"
          className="admin-link-button"
          disabled={exporting}
          onClick={() => void handleExport('filtered', 'csv')}
        >
          Filtered CSV
        </button>

        <button
          type="button"
          className="admin-link-button"
          disabled={exporting}
          onClick={() => void handleExport('all', 'csv')}
        >
          All CSV
        </button>
      </div>

      <div className="admin-table-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allCurrentPageSelected}
                    onChange={toggleCurrentPage}
                  />
                </th>

                {SORT_FIELDS.map((field) => (
                  <th key={field.key}>
                    <button
                      type="button"
                      className="table-sort-button"
                      onClick={() => changeSort(field.key)}
                    >
                      {field.label}

                      {sortBy === field.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                    </button>
                  </th>
                ))}

                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="table-empty">
                    Loading records...
                  </td>
                </tr>
              ) : data?.items.length ? (
                data.items.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(record.id)}
                        onChange={() => toggleSelection(record.id)}
                      />
                    </td>

                    <td>
                      <a href={`/records/${record.id}`} className="record-link">
                        {toTitleCaseName(record.fullName) || 'Unnamed'}
                      </a>
                    </td>

                    <td>{toTitleCaseName(record.userName) || '—'}</td>

                    <td>{record.email || '—'}</td>

                    <td>{record.phoneNumber || '—'}</td>

                    <td>{record.pukNumber || '—'}</td>

                    <td>{new Date(record.createdAt).toLocaleDateString()}</td>

                    <td>
                      {record.confidence == null ? '—' : `${Math.round(record.confidence * 100)}%`}
                    </td>

                    <td>
                      <span className={`status-badge status-${record.status.toLowerCase()}`}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="table-empty">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && (
          <div className="pagination">
            <span>
              Showing {data.items.length} of {data.total} records
            </span>

            <div>
              <button
                type="button"
                className="admin-button secondary"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>

              <span className="pagination-page">
                Page {data.page} of {data.totalPages}
              </span>

              <button
                type="button"
                className="admin-button secondary"
                disabled={page >= data.totalPages}
                onClick={() => setPage((current) => Math.min(data.totalPages, current + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
