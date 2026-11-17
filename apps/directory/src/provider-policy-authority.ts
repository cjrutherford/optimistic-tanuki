import { createHash, createPublicKey, KeyObject, verify } from 'node:crypto';

const sha = /^[a-f0-9]{64}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fields = [
  'version',
  'policyId',
  'subject',
  'assetSha256',
  'etag',
  'methods',
  'maxCostCents',
  'issuedAt',
  'expiresAt',
];
export type SignedProviderGrant = { payload: string; signature: string };
export type ProviderAttempt = {
  attemptId: string;
  asset: string;
  etag: string;
  method: string;
};
export type ProviderGrant = {
  version: 's4-private-source-v1';
  policyId: string;
  subject: string;
  assetSha256: string;
  etag: string;
  methods: string[];
  maxCostCents: number;
  issuedAt: number;
  expiresAt: number;
};

/** Verifies a short-lived grant against a separately provisioned Ed25519 public key. */
export function verifyProviderGrant(
  publicKey: KeyObject | string | Buffer,
  token: SignedProviderGrant,
  attempt: ProviderAttempt
): ProviderGrant {
  let key: KeyObject;
  try {
    key =
      publicKey instanceof KeyObject ? publicKey : createPublicKey(publicKey);
  } catch {
    throw Error('Invalid grant verification key');
  }
  if (key.type !== 'public' || key.asymmetricKeyType !== 'ed25519')
    throw Error('Invalid grant verification key');
  if (
    !token ||
    typeof token !== 'object' ||
    Array.isArray(token) ||
    Object.keys(token).sort().join(',') !== 'payload,signature' ||
    typeof token.payload !== 'string' ||
    token.payload.length > 8192 ||
    !/^[A-Za-z0-9_-]+$/.test(token.payload) ||
    typeof token.signature !== 'string' ||
    !/^[A-Za-z0-9_-]+$/.test(token.signature)
  )
    throw Error('Invalid grant');
  const signature = Buffer.from(token.signature, 'base64url');
  if (
    signature.length !== 64 ||
    signature.toString('base64url') !== token.signature ||
    !verify(null, Buffer.from(token.payload), key, signature)
  )
    throw Error('Invalid grant signature');
  const encoded = Buffer.from(token.payload, 'base64url');
  if (encoded.toString('base64url') !== token.payload)
    throw Error('Invalid grant');
  let grant: ProviderGrant;
  try {
    grant = JSON.parse(encoded.toString('utf8'));
  } catch {
    throw Error('Invalid grant');
  }
  if (
    !grant ||
    typeof grant !== 'object' ||
    Array.isArray(grant) ||
    Object.keys(grant).length !== fields.length ||
    fields.some(
      (field) => !Object.prototype.hasOwnProperty.call(grant, field)
    ) ||
    grant.version !== 's4-private-source-v1' ||
    !sha.test(grant.policyId || '') ||
    !uuid.test(grant.subject || '') ||
    !sha.test(grant.assetSha256 || '') ||
    typeof grant.etag !== 'string' ||
    !/^[A-Za-z0-9-]{1,100}$/.test(grant.etag) ||
    !Array.isArray(grant.methods) ||
    grant.methods.length < 1 ||
    grant.methods.length > 2 ||
    new Set(grant.methods).size !== grant.methods.length ||
    !grant.methods.every((method) => method === 'GET' || method === 'HEAD') ||
    !Number.isSafeInteger(grant.maxCostCents) ||
    grant.maxCostCents < 1 ||
    grant.maxCostCents > 2500 ||
    !Number.isSafeInteger(grant.issuedAt) ||
    !Number.isSafeInteger(grant.expiresAt) ||
    grant.expiresAt <= grant.issuedAt ||
    grant.expiresAt - grant.issuedAt > 900000
  )
    throw Error('Invalid grant');
  const now = Date.now();
  if (grant.issuedAt > now + 30000 || grant.expiresAt <= now)
    throw Error('Grant expired or not yet valid');
  if (
    !attempt ||
    !uuid.test(attempt.attemptId || '') ||
    typeof attempt.asset !== 'string' ||
    attempt.etag !== grant.etag ||
    createHash('sha256').update(attempt.asset).digest('hex') !==
      grant.assetSha256
  )
    throw Error('Grant source mismatch');
  if (!(grant.methods as string[]).includes(attempt.method))
    throw Error('Grant method denied');
  return grant;
}
