import { v7 as uuidv7 } from 'uuid';

/**
 * Generate a UUID v7.
 *
 * UUID v7 is time-ordered (first 48 bits are a millisecond timestamp), which
 * makes b-tree index inserts append-only and gives natural chronological
 * ordering when used as a primary key. Replaces v4 across the schema.
 */
export function newId(): string {
  return uuidv7();
}
