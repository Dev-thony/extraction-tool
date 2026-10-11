'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface FieldConfidences {
  fullName?: number;
  userName?: number;
  email?: number;
  phoneNumber?: number;
  pukNumber?: number;
}

interface RecordLog {
  id: string;
  event: string;
  level: string;
  message: string;
  meta: unknown;
  createdAt: string;
}

interface RecordData {
  id: string;
  imageUrl: string;
  fullName: string | null;
  userName: string | null;
  email: string | null;
  phoneNumber: string | null;
  pukNumber: string | null;
  confidence: number | null;
  fieldConfidences: unknown;
  rawOCR: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  logs: RecordLog[];
}

interface Props {
  record: RecordData;
}

const LOW_CONFIDENCE = 0.7;

export function RecordEditor({ record }: Props) {
  const router = useRouter();

  const initialConfidences = isFieldConfidences(record.fieldConfidences)
    ? record.fieldConfidences
    : {};

  const [form, setForm] = useState({
    fullName: record.fullName ?? '',
    userName: record.userName ?? '',
    email: record.email ?? '',
    phoneNumber: record.phoneNumber ?? '',
    pukNumber: record.pukNumber ?? '',
    status: record.status,
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function saveRecord() {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch(`/api/records/${record.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: nullable(form.fullName),
          userName: nullable(form.userName),
          email: nullable(form.email),
          phoneNumber: nullable(form.phoneNumber),
          pukNumber: nullable(form.pukNumber),
          status: form.status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to save record.');
      }

      setMessage('Record saved successfully.');

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save record.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord() {
    const confirmed = window.confirm('Are you sure you want to permanently delete this record?');

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      const response = await fetch(`/api/records/${record.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to delete record.');
      }

      router.replace('/records');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete record.');
      setDeleting(false);
    }
  }

  return (
    <div>
      {(message || error) && (
        <div
          style={{
            marginBottom: 20,
            padding: 14,
            borderRadius: 10,
            background: error ? '#fef2f2' : '#ecfdf5',
            color: error ? '#b91c1c' : '#047857',
          }}
        >
          {error || message}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(300px, 1fr) minmax(360px, 1fr)',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <ImagePanel imageUrl={record.imageUrl} recordId={record.id} />

        <div
          className="card"
          style={{
            padding: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 22,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 20,
              }}
            >
              Extracted Information
            </h2>

            <ConfidenceBadge value={record.confidence} />
          </div>

          <div
            style={{
              display: 'grid',
              gap: 16,
            }}
          >
            <EditableField
              label="Full Name"
              value={form.fullName}
              confidence={initialConfidences.fullName}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  fullName: value,
                }))
              }
            />

            <EditableField
              label="Partnership Name"
              value={form.userName}
              confidence={initialConfidences.userName}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  userName: value,
                }))
              }
            />

            <EditableField
              label="Email"
              value={form.email}
              confidence={initialConfidences.email}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  email: value,
                }))
              }
            />

            <EditableField
              label="Phone Number"
              value={form.phoneNumber}
              confidence={initialConfidences.phoneNumber}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  phoneNumber: value,
                }))
              }
            />

            <EditableField
              label="PUK Number"
              value={form.pukNumber}
              confidence={initialConfidences.pukNumber}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  pukNumber: value,
                }))
              }
            />

            <label>
              <span className="field-label">Processing Status</span>

              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                className="field-input"
              >
                <option value="PENDING">Pending</option>

                <option value="PROCESSING">Processing</option>

                <option value="NEEDS_REVIEW">Needs Review</option>

                <option value="PROCESSED">Processed</option>

                <option value="FAILED">Failed</option>
              </select>
            </label>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 26,
              paddingTop: 20,
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <button
              type="button"
              onClick={deleteRecord}
              disabled={deleting || saving}
              style={{
                padding: '11px 16px',
                border: '1px solid #fecaca',
                borderRadius: 9,
                background: '#fff',
                color: '#dc2626',
                fontWeight: 600,
              }}
            >
              {deleting ? 'Deleting...' : 'Delete Record'}
            </button>

            <button
              type="button"
              onClick={saveRecord}
              disabled={saving || deleting}
              style={{
                padding: '11px 20px',
                border: 0,
                borderRadius: 9,
                background: '#059669',
                color: '#fff',
                fontWeight: 600,
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)',
          gap: 20,
          marginTop: 20,
        }}
      >
        <RawOcrPanel rawOCR={record.rawOCR} />

        <LogsPanel logs={record.logs} />
      </div>
    </div>
  );
}

function ImagePanel({ imageUrl, recordId }: { imageUrl: string; recordId: string }) {
  return (
    <div
      className="card"
      style={{
        padding: 18,
        position: 'sticky',
        top: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 18,
          }}
        >
          Original Image
        </h2>

        <span
          style={{
            color: '#64748b',
            fontSize: 12,
          }}
        >
          {recordId}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
          overflow: 'hidden',
          borderRadius: 12,
          background: '#f1f5f9',
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Uploaded handwritten document"
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: '75vh',
              objectFit: 'contain',
            }}
          />
        ) : (
          <div
            style={{
              color: '#64748b',
            }}
          >
            No image available.
          </div>
        )}
      </div>
    </div>
  );
}

function EditableField({
  label,
  value,
  confidence,
  onChange,
}: {
  label: string;
  value: string;
  confidence?: number;
  onChange: (value: string) => void;
}) {
  const lowConfidence = confidence !== undefined && confidence < LOW_CONFIDENCE;

  return (
    <label>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 7,
        }}
      >
        <span className="field-label">{label}</span>

        {confidence !== undefined && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: lowConfidence ? '#b45309' : '#047857',
            }}
          >
            {Math.round(confidence * 100)}%
          </span>
        )}
      </div>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-input"
        style={{
          borderColor: lowConfidence ? '#f59e0b' : '#cbd5e1',
          background: lowConfidence ? '#fffbeb' : '#fff',
        }}
      />
    </label>
  );
}

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <span
        style={{
          padding: '6px 10px',
          borderRadius: 999,
          background: '#f1f5f9',
          color: '#64748b',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        No confidence
      </span>
    );
  }

  const percentage = Math.round(value * 100);
  const low = value < LOW_CONFIDENCE;

  return (
    <span
      style={{
        padding: '6px 10px',
        borderRadius: 999,
        background: low ? '#fef3c7' : '#dcfce7',
        color: low ? '#92400e' : '#166534',
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {percentage}% confidence
    </span>
  );
}

function RawOcrPanel({ rawOCR }: { rawOCR: string | null }) {
  return (
    <section
      className="card"
      style={{
        padding: 22,
      }}
    >
      <h2
        style={{
          marginTop: 0,
          fontSize: 18,
        }}
      >
        Raw OCR
      </h2>

      <pre
        style={{
          margin: 0,
          padding: 16,
          minHeight: 180,
          overflow: 'auto',
          borderRadius: 10,
          background: '#0f172a',
          color: '#e2e8f0',
          fontSize: 13,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {rawOCR || 'No raw OCR text available.'}
      </pre>
    </section>
  );
}

function LogsPanel({ logs }: { logs: RecordLog[] }) {
  return (
    <section
      className="card"
      style={{
        padding: 22,
      }}
    >
      <h2
        style={{
          marginTop: 0,
          fontSize: 18,
        }}
      >
        Processing Logs
      </h2>

      {logs.length === 0 ? (
        <p style={{ color: '#64748b' }}>No processing logs available.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 12,
          }}
        >
          {logs.map((log) => (
            <div
              key={log.id}
              style={{
                padding: 14,
                borderRadius: 10,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <strong
                  style={{
                    fontSize: 13,
                  }}
                >
                  {log.event}
                </strong>

                <span
                  style={{
                    color: '#64748b',
                    fontSize: 11,
                  }}
                >
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>

              <p
                style={{
                  margin: '7px 0 0',
                  color: '#475569',
                  fontSize: 13,
                }}
              >
                {log.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function nullable(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function isFieldConfidences(value: unknown): value is FieldConfidences {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const object = value as Record<string, unknown>;

  return ['fullName', 'userName', 'email', 'phoneNumber', 'pukNumber'].some(
    (key) => typeof object[key] === 'number',
  );
}
