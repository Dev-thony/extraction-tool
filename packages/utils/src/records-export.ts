import * as XLSX from 'xlsx';
import {
  EXTRACTION_FIELD_KEYS,
  EXTRACTION_FIELD_LABELS,
  type ExtractionRecord,
} from '@extraction/types';

/** One spreadsheet column: a header and how to derive its cell from a record. */
export interface ExportColumn {
  header: string;
  value: (record: ExtractionRecord) => string;
}

/**
 * Column order for every export. Extracted fields come first (headers taken
 * straight from the schema labels, so "Partnership Name" maps to `userName`),
 * followed by record metadata.
 */
export const RECORD_EXPORT_COLUMNS: ExportColumn[] = [
  ...EXTRACTION_FIELD_KEYS.map(
    (key): ExportColumn => ({
      header: EXTRACTION_FIELD_LABELS[key],
      value: (record) => record[key] ?? '',
    }),
  ),
  { header: 'Status', value: (record) => record.status },
  {
    header: 'Confidence',
    value: (record) => (record.confidence == null ? '' : `${Math.round(record.confidence * 100)}%`),
  },
  { header: 'Uploaded By', value: (record) => record.uploadedBy ?? '' },
  { header: 'Upload Date', value: (record) => new Date(record.createdAt).toISOString() },
  { header: 'Record ID', value: (record) => record.id },
];

function toRows(records: ExtractionRecord[]): Record<string, string>[] {
  return records.map((record) => {
    const row: Record<string, string> = {};
    for (const column of RECORD_EXPORT_COLUMNS) {
      row[column.header] = column.value(record);
    }
    return row;
  });
}

/** Builds a SheetJS workbook with a single "Records" sheet and schema headers. */
export function buildRecordsWorkbook(records: ExtractionRecord[]): XLSX.WorkBook {
  const headers = RECORD_EXPORT_COLUMNS.map((column) => column.header);
  const worksheet = XLSX.utils.json_to_sheet(toRows(records), { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Records');
  return workbook;
}

export function recordsToXlsxBuffer(records: ExtractionRecord[]): Buffer {
  const workbook = buildRecordsWorkbook(records);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function recordsToCsv(records: ExtractionRecord[]): string {
  const workbook = buildRecordsWorkbook(records);
  const worksheet = workbook.Sheets['Records'];
  if (!worksheet) return '';
  return XLSX.utils.sheet_to_csv(worksheet);
}
