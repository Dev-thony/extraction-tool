export type ExportFormat = 'xlsx' | 'csv';

export type ExportScope = 'selected' | 'filtered' | 'all';

interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  ids?: string[];
  filters?: {
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortDir?: string;
  };
}

export async function exportRecords(options: ExportOptions) {
  const response = await fetch('/api/export', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    let message = 'Export failed.';

    try {
      const data = await response.json();

      if (data?.error) {
        message = data.error;
      }
    } catch {
      // Ignore invalid JSON response.
    }

    throw new Error(message);
  }

  const blob = await response.blob();

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;

  anchor.download = options.format === 'xlsx' ? 'records.xlsx' : 'records.csv';

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}
