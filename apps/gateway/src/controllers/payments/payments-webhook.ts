import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verifies a Lemon Squeezy webhook signature.
 *
 * Lemon Squeezy signs each webhook by computing a hex-encoded HMAC-SHA256 of
 * the raw request body using the store's signing secret and sends it in the
 * `X-Signature` header. We recompute the digest over the exact received bytes
 * and compare using a constant-time comparison with an equal-length guard.
 *
 * Returns `false` (never throws) when any input is missing or the digest does
 * not match so callers can fail closed.
 */
export const verifyWebhookSignature = (
  rawBody: Buffer | undefined,
  signature: string | undefined,
  secret: string | undefined
): boolean => {
  if (!secret || !signature || !rawBody || rawBody.length === 0) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(signature, 'hex');

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
};
