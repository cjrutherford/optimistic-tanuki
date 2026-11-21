import { createHash, createHmac } from 'node:crypto';

/**
 * Canonical hashing for the durable source binding of reviewed fields
 * (S5-item4-source-binding-design.md, sections 1.3 and 1.4).
 *
 * Content hashes are keyed (HMAC-SHA-256) so a retained digest of withdrawn
 * contact data is not a guessable derivative. The key is held by the Directory.
 */

export type BindingKey = string | Buffer;

export const BINDING_FIELD_ORIGINS = {
  name: 'live_row',
  category: 'live_row',
  point: 'live_row',
  address: 'candidate',
  website: 'candidate',
  phone: 'candidate',
  attribution: 'stage',
  notices: 'stage',
  termsUrls: 'stage',
} as const;

export type BindingFieldName = keyof typeof BINDING_FIELD_ORIGINS;
export type BindingFieldOrigin =
  (typeof BINDING_FIELD_ORIGINS)[BindingFieldName];
export type BindingFieldHashes = Record<
  BindingFieldName,
  { hash: string; origin: BindingFieldOrigin }
>;

const normalize = (value: unknown): unknown => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw Error('Cannot hash a non-finite number');
    return value;
  }
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) out[key] = normalize(item);
    }
    return out;
  }
  throw Error('Cannot hash this value');
};

/** Sorted keys, trimmed strings, no insignificant whitespace. Absent values are null. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function requireKey(key: BindingKey): void {
  if ((typeof key !== 'string' && !Buffer.isBuffer(key)) || key.length < 32) {
    throw Error('A reviewed-binding hash key of at least 32 bytes is required');
  }
}

/** Reads the Directory-held key from the environment; never logs it. */
export function reviewedBindingKeyFromEnv(
  env: NodeJS.ProcessEnv = process.env
): string {
  const key = env.DIRECTORY_REVIEWED_BINDING_HMAC_KEY;
  if (!key || key.length < 32)
    throw Error(
      'DIRECTORY_REVIEWED_BINDING_HMAC_KEY (32+ characters) is required'
    );
  return key;
}

export function keyedHash(key: BindingKey, value: unknown): string {
  requireKey(key);
  return createHmac('sha256', key).update(canonicalJson(value)).digest('hex');
}

/** Plain hash, for documents that are not withdrawn content (the display policy). */
export function documentHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

/** The part of a stage listing that feeds publication. */
export function stageContentSubset(listing: any): Record<string, unknown> {
  const l = listing ?? {};
  return {
    name: l.name,
    category: l.category,
    location: l.location,
    addresses: l.addresses,
    websites: l.websites,
    phones: l.phones,
    sources: l.sources,
  };
}

export function stageContentHash(key: BindingKey, listing: unknown): string {
  return keyedHash(key, stageContentSubset(listing));
}

export function reviewedHash(key: BindingKey, reviewed: unknown): string {
  if (!reviewed || typeof reviewed !== 'object')
    throw Error('Reviewed object is required');
  return keyedHash(key, reviewed);
}

/** Per-field hashes. Absent optional fields all hash as null, distinct from ''. */
export function fieldHashes(
  key: BindingKey,
  values: Partial<Record<BindingFieldName, unknown>>
): BindingFieldHashes {
  const out = {} as BindingFieldHashes;
  for (const name of Object.keys(BINDING_FIELD_ORIGINS) as BindingFieldName[]) {
    out[name] = {
      hash: keyedHash(key, values[name]),
      origin: BINDING_FIELD_ORIGINS[name],
    };
  }
  return out;
}
