import { describe, expect, it } from 'vitest';
import type { ExtractionRecord } from '@extraction/types';
import {
  averageConfidence,
  confidenceLevel,
  formatConfidencePercent,
  isLowConfidence,
  isValidEmail,
  recordsToCsv,
} from './index';

describe('confidence helpers', () => {
  it('buckets values into low/medium/high around the threshold', () => {
    expect(confidenceLevel(0.5)).toBe('low');
    expect(confidenceLevel(0.75)).toBe('medium');
    expect(confidenceLevel(0.95)).toBe('high');
  });

  it('treats missing confidence as low', () => {
    expect(isLowConfidence(null)).toBe(true);
    expect(isLowConfidence(undefined)).toBe(true);
    expect(isLowConfidence(0.9)).toBe(false);
  });

  it('formats and averages confidences', () => {
    expect(formatConfidencePercent(0.833)).toBe('83%');
    expect(formatConfidencePercent(null)).toBe('—');
    expect(averageConfidence([0.5, 1, null])).toBeCloseTo(0.75);
    expect(averageConfidence([null, undefined])).toBeNull();
  });
});

describe('validation helpers', () => {
  it('recognizes valid emails and rejects malformed ones', () => {
    expect(isValidEmail('ada@example.com')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });
});

describe('records export', () => {
  const record: ExtractionRecord = {
    id: 'rec_1',
    imageUrl: '/x.png',
    imageKey: 'x.png',
    fullName: 'Ada Lovelace',
    userName: 'AnalyticalEngine',
    email: 'ada@example.com',
    phoneNumber: '+1 555 000',
    pukNumber: '12345678',
    confidence: 0.9,
    fieldConfidences: null,
    rawOCR: null,
    status: 'PROCESSED',
    uploadedBy: 'staff-1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  it('emits schema headers (incl. Partnership Name alias) and a data row', () => {
    const csv = recordsToCsv([record]);
    const [header, firstRow] = csv.trim().split('\n');
    expect(header).toContain('Full Name');
    expect(header).toContain('Partnership Name');
    expect(header).toContain('PUK Number');
    expect(firstRow).toContain('Ada Lovelace');
    expect(firstRow).toContain('AnalyticalEngine');
    expect(firstRow).toContain('90%');
  });
});
