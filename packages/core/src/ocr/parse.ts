import {
  ExtractedFieldsSchema,
  FieldConfidencesSchema,
  ExtractedRecordSchema,
  type ExtractedFields,
  type FieldConfidences,
  type ExtractedRecord,
  type OcrResult,
} from '@extraction/types';

import { OcrParseError } from '../errors';
import { calculateConfidence } from './confidence';

/**
 * Strips markdown code fences that models sometimes add around JSON.
 */
function stripCodeFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  return fenced?.[1] ?? text;
}

/**
 * Finds the first balanced top-level JSON object.
 */
function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{');

  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function pickFieldsSource(parsed: Record<string, unknown>): unknown {
  if (parsed.fields && typeof parsed.fields === 'object') {
    return parsed.fields;
  }

  return parsed;
}

function pickConfidencesSource(parsed: Record<string, unknown>): unknown {
  if (parsed.fieldConfidences && typeof parsed.fieldConfidences === 'object') {
    return parsed.fieldConfidences;
  }

  if (parsed.confidences && typeof parsed.confidences === 'object') {
    return parsed.confidences;
  }

  return {};
}

/**
 * Parses one extracted record.
 */
function parseRecord(input: unknown): ExtractedRecord {
  if (typeof input !== 'object' || input === null) {
    throw new OcrParseError('One OCR record was not a JSON object');
  }

  const root = input as Record<string, unknown>;

  const fieldsResult = ExtractedFieldsSchema.safeParse(pickFieldsSource(root));

  if (!fieldsResult.success) {
    throw new OcrParseError('Could not map OCR record to expected fields');
  }

  const fields: ExtractedFields = fieldsResult.data;

  const confidencesResult = FieldConfidencesSchema.safeParse(pickConfidencesSource(root));

  const fieldConfidences: FieldConfidences = confidencesResult.success
    ? confidencesResult.data
    : {};

  const calculatedConfidence = calculateConfidence(fields, fieldConfidences);

  const explicitConfidence =
    typeof root.overallConfidence === 'number' && Number.isFinite(root.overallConfidence)
      ? Math.max(0, Math.min(1, root.overallConfidence))
      : calculatedConfidence;

  const recordResult = ExtractedRecordSchema.safeParse({
    fields,
    fieldConfidences,
    overallConfidence: explicitConfidence,
  });

  if (!recordResult.success) {
    throw new OcrParseError('Could not validate extracted OCR record');
  }

  return recordResult.data;
}

/**
 * Parses a vision model response into an OCR result containing
 * one or more extracted people.
 */
export function parseStructuredData(modelText: string, rawTextFallback = ''): OcrResult {
  const candidate = extractFirstJsonObject(stripCodeFences(modelText));

  if (!candidate) {
    throw new OcrParseError('No JSON object found in model response');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(candidate);
  } catch (cause) {
    throw new OcrParseError('Model response was not valid JSON', cause);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new OcrParseError('Model response JSON was not an object');
  }

  const root = parsed as Record<string, unknown>;

  /*
   * New format:
   *
   * {
   *   "records": [...]
   * }
   */
  if (Array.isArray(root.records)) {
    if (root.records.length === 0) {
      throw new OcrParseError('OCR returned zero records');
    }

    const records: ExtractedRecord[] = [];

    for (const item of root.records) {
      records.push(parseRecord(item));
    }

    const rawText =
      typeof root.rawText === 'string' && root.rawText.trim().length > 0
        ? root.rawText
        : rawTextFallback;

    const warnings: string[] = [];

    const malformedConfidenceCount = root.records.filter((item) => {
      if (typeof item !== 'object' || item === null) {
        return true;
      }

      const record = item as Record<string, unknown>;

      return (
        record.fieldConfidences !== undefined &&
        !FieldConfidencesSchema.safeParse(record.fieldConfidences).success
      );
    }).length;

    if (malformedConfidenceCount > 0) {
      warnings.push(
        `${malformedConfidenceCount} record(s) had missing or malformed field confidences.`,
      );
    }

    return {
      rawText,
      records,
      warnings,
    };
  }

  /*
   * Backwards compatibility:
   *
   * If a provider still returns the old single-record shape,
   * convert it into records[0].
   */
  const record = parseRecord(root);

  const rawText =
    typeof root.rawText === 'string' && root.rawText.trim().length > 0
      ? root.rawText
      : rawTextFallback;

  return {
    rawText,
    records: [record],
    warnings: ['OCR provider returned the legacy single-record format.'],
  };
}
