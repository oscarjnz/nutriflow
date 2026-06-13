import { createHash } from 'node:crypto';

/**
 * Stable SHA-256 of a normalized string, hex-encoded.
 *
 * Used as the `nlp_cache` key. Normalization (trim + lowercase + collapse
 * whitespace) means "  Dos Huevos " and "dos huevos" share a cache entry,
 * maximizing hit rate without persisting raw user text beyond `input_text`.
 */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function normalizeForHash(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function nlpCacheKey(text: string): string {
  return sha256Hex(normalizeForHash(text));
}
