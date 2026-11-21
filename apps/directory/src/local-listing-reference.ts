import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

type Context = {
  town: string;
  changeToken: string;
  adult: boolean;
  generation?: string;
};
type Position = { scanId: string; row: string };
const uuid = (v: unknown) =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const validContext = (c: Context) =>
  !!c &&
  uuid(c.town) &&
  uuid(c.changeToken) &&
  typeof c.adult === 'boolean' &&
  (c.generation === undefined ||
    (typeof c.generation === 'string' && /^[a-f0-9]{64}$/.test(c.generation)));
const validPosition = (p: Position) =>
  !!p &&
  typeof p.scanId === 'string' &&
  /^[a-f0-9]{64}$/.test(p.scanId) &&
  typeof p.row === 'string' &&
  /^(0|[1-9][0-9]{0,15})$/.test(p.row) &&
  Number.isSafeInteger(Number(p.row));
const normalized = (c: Context) => [
  c.town.toLowerCase(),
  c.changeToken.toLowerCase(),
  c.adult,
  ...(c.generation === undefined ? [] : [c.generation]),
];
function key(secret: string) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32)
    throw Error('Invalid reference secret');
  return createHash('sha256')
    .update('local-listing-reference-v1\0')
    .update(secret)
    .digest();
}

/** Temporary opaque detail reference, never an ownership claim or canonical business ID. */
export function sealListingReference(
  secret: string,
  context: Context,
  position: Position,
  now = Date.now()
): string {
  const k = key(secret);
  if (
    !validContext(context) ||
    !validPosition(position) ||
    !Number.isSafeInteger(now) ||
    now < 0
  )
    throw Error('Invalid reference input');
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', k, iv);
  cipher.setAAD(Buffer.from('local-listing-reference-v1'));
  const body = Buffer.concat([
    cipher.update(
      JSON.stringify({ v: 1, c: normalized(context), p: position, iat: now }),
      'utf8'
    ),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}
export function openListingReference(
  secret: string,
  context: Context,
  reference: string,
  now = Date.now()
): Position {
  const k = key(secret);
  if (
    !validContext(context) ||
    typeof reference !== 'string' ||
    reference.length > 2048 ||
    !/^[A-Za-z0-9_-]+$/.test(reference) ||
    !Number.isSafeInteger(now) ||
    now < 0
  )
    throw Error('Invalid reference');
  try {
    const raw = Buffer.from(reference, 'base64url');
    if (raw.length < 29 || raw.toString('base64url') !== reference)
      throw Error();
    const decipher = createDecipheriv('aes-256-gcm', k, raw.subarray(0, 12));
    decipher.setAAD(Buffer.from('local-listing-reference-v1'));
    decipher.setAuthTag(raw.subarray(12, 28));
    const payload = JSON.parse(
      Buffer.concat([
        decipher.update(raw.subarray(28)),
        decipher.final(),
      ]).toString('utf8')
    );
    if (
      payload.v !== 1 ||
      JSON.stringify(payload.c) !== JSON.stringify(normalized(context)) ||
      !validPosition(payload.p) ||
      !Number.isSafeInteger(payload.iat) ||
      payload.iat > now ||
      now - payload.iat > 900000
    )
      throw Error();
    return payload.p;
  } catch {
    throw Error('Invalid reference');
  }
}
