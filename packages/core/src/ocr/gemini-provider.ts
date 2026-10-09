import type { OcrResult } from '@extraction/types';

import { OcrError } from '../errors';
import { parseStructuredData } from './parse';
import { buildExtractionPrompt } from './prompt';
import type { OcrInput, OcrProvider } from './provider';

export interface GeminiOcrOptions {
  apiKey: string;
  model: string;
}

/**
 * OCR provider backed by Google Gemini Vision. The SDK is imported dynamically so
 * that projects using the default mock provider never need `@google/generative-ai`
 * resolved at module load, and so bundlers don't pull it into the client.
 */
export class GeminiOcrProvider implements OcrProvider {
  readonly name = 'gemini';

  constructor(private readonly options: GeminiOcrOptions) {}

  async extract(input: OcrInput): Promise<OcrResult> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');

    const client = new GoogleGenerativeAI(this.options.apiKey);
    const model = client.getGenerativeModel({
      model: this.options.model,
      // Force a JSON-only response; combined with the prompt this keeps the
      // parser's job to recovery rather than heavy cleanup.
      generationConfig: { responseMimeType: 'application/json' },
    });

    let text: string;
    try {
      const response = await model.generateContent([
        { text: buildExtractionPrompt() },
        {
          inlineData: {
            data: input.image.toString('base64'),
            mimeType: input.mimeType,
          },
        },
      ]);
      text = response.response.text();
    } catch (cause) {
      throw new OcrError('Gemini request failed', cause);
    }

    // May throw OcrParseError — the service layer decides whether to retry.
    return parseStructuredData(text);
  }
}
