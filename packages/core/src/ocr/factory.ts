import { ConfigError } from '../errors';
import type { Env } from '../env';
import { GeminiOcrProvider } from './gemini-provider';
import { MockOcrProvider } from './mock-provider';
import type { OcrProvider } from './provider';

/**
 * Selects the OCR provider from configuration. Defaults keep the platform on the
 * mock provider; switching to Gemini requires only `OCR_PROVIDER=gemini` plus a
 * key — no code change.
 */
export function getOcrProvider(env: Env): OcrProvider {
  switch (env.OCR_PROVIDER) {
    case 'gemini': {
      if (!env.GEMINI_API_KEY) {
        throw new ConfigError('OCR_PROVIDER=gemini requires GEMINI_API_KEY to be set');
      }
      return new GeminiOcrProvider({
        apiKey: env.GEMINI_API_KEY,
        model: env.GEMINI_MODEL,
      });
    }
    case 'mock':
      return new MockOcrProvider();
    default: {
      // Exhaustive: the enum only permits the cases above.
      const never: never = env.OCR_PROVIDER;
      throw new ConfigError(`Unknown OCR_PROVIDER: ${String(never)}`);
    }
  }
}
