import { describe, expect, it } from 'vitest';
import {
  ExtractedFieldsSchema,
  OcrResultSchema,
  RecordListQuerySchema,
  UpdateRecordInputSchema,
} from './index';

describe('ExtractedFieldsSchema (lenient model-output parsing)', () => {
  it('coerces blanks and missing keys to null without throwing', () => {
    const result = ExtractedFieldsSchema.parse({ fullName: '  ', email: undefined });
    expect(result).toEqual({
      fullName: null,
      userName: null,
      email: null,
      phoneNumber: null,
      pukNumber: null,
    });
  });

  it('trims strings and stringifies scalars instead of discarding them', () => {
    const result = ExtractedFieldsSchema.parse({
      fullName: '  Ada Lovelace ',
      phoneNumber: 1234567890,
      email: 'not-an-email', // kept verbatim; reviewer fixes it
    });
    expect(result.fullName).toBe('Ada Lovelace');
    expect(result.phoneNumber).toBe('1234567890');
    expect(result.email).toBe('not-an-email');
  });
});

describe('OcrResultSchema', () => {
  it('defaults warnings to an empty array', () => {
    const result = OcrResultSchema.parse({
      rawText: 'hello',
      fields: {},
      fieldConfidences: {},
      overallConfidence: 0.9,
    });
    expect(result.warnings).toEqual([]);
  });

  it('rejects confidence outside 0..1', () => {
    expect(() =>
      OcrResultSchema.parse({
        rawText: '',
        fields: {},
        fieldConfidences: {},
        overallConfidence: 1.5,
      }),
    ).toThrow();
  });
});

describe('RecordListQuerySchema', () => {
  it('applies defaults and coerces string params', () => {
    const query = RecordListQuerySchema.parse({ page: '2', pageSize: '50' });
    expect(query).toMatchObject({ page: 2, pageSize: 50, sortBy: 'createdAt', sortDir: 'desc' });
  });
});

describe('UpdateRecordInputSchema', () => {
  it('rejects unknown fields', () => {
    expect(() => UpdateRecordInputSchema.parse({ hacker: true })).toThrow();
  });
});
