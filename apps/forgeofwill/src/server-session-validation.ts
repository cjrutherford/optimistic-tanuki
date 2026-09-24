export interface ServerSessionRequest {
  cookies?: Record<string, string | undefined>;
  headers?: { authorization?: string | undefined };
}

type GatewayFetch = (
  input: string,
  init?: RequestInit
) => Promise<Pick<Response, 'ok'>>;

export interface GatewaySessionValidatorOptions {
  gatewayUrl: string;
  fetch?: GatewayFetch;
  timeoutMs?: number;
  /**
   * How long a negative (invalid/unreachable) result is served from memory
   * instead of re-hitting the gateway. Bounds the cost of a redirect loop
   * re-requesting the same protected document with the same dead cookie.
   */
  negativeTtlMs?: number;
  /** Upper bound for cached negative entries; oldest expire first. */
  negativeCacheMaxSize?: number;
}

const DEFAULT_SESSION_VALIDATION_TIMEOUT_MS = 3000;
const DEFAULT_NEGATIVE_TTL_MS = 10_000;
const DEFAULT_NEGATIVE_CACHE_MAX_SIZE = 1_000;

/**
 * Validates the opaque browser session with the gateway. Forge deliberately
 * does not decode, inspect, or accept a bearer substitute for this cookie.
 *
 * Concurrent validations sharing one cookie share one gateway request, and
 * recent negative results are served from a short-lived memory cache so a
 * session loop cannot turn every document re-request into another RPC.
 * Positive results are never time-cached: a revoked session must fail
 * closed on its next validation after in-flight sharing settles.
 */
export function createGatewaySessionValidator({
  gatewayUrl,
  fetch: fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_SESSION_VALIDATION_TIMEOUT_MS,
  negativeTtlMs = DEFAULT_NEGATIVE_TTL_MS,
  negativeCacheMaxSize = DEFAULT_NEGATIVE_CACHE_MAX_SIZE,
}: GatewaySessionValidatorOptions) {
  const sessionUrl = `${gatewayUrl.replace(
    /\/$/,
    ''
  )}/api/authentication/session`;
  const inflight = new Map<string, Promise<boolean>>();
  const negativeCache = new Map<string, number>();

  const readNegativeCache = (session: string): boolean | undefined => {
    const expiresAt = negativeCache.get(session);
    if (expiresAt === undefined) return undefined;
    if (expiresAt <= Date.now()) {
      negativeCache.delete(session);
      return undefined;
    }
    return false;
  };

  const writeNegativeCache = (session: string): void => {
    if (negativeCache.size >= negativeCacheMaxSize) {
      const oldest = negativeCache.keys().next();
      if (!oldest.done) negativeCache.delete(oldest.value);
    }
    negativeCache.set(session, Date.now() + negativeTtlMs);
  };

  const fetchSession = async (session: string): Promise<boolean> => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);
    try {
      const response = await fetchImpl(sessionUrl, {
        method: 'GET',
        headers: { Cookie: `ot_session=${encodeURIComponent(session)}` },
        signal: abortController.signal,
      });
      if (!response.ok) writeNegativeCache(session);
      else negativeCache.delete(session);
      return response.ok;
    } catch {
      writeNegativeCache(session);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  };

  return (request: ServerSessionRequest): Promise<boolean> => {
    const session = request.cookies?.['ot_session'];
    if (typeof session !== 'string' || session.length === 0) {
      return Promise.resolve(false);
    }

    const cached = readNegativeCache(session);
    if (cached !== undefined) return Promise.resolve(cached);

    const shared = inflight.get(session);
    if (shared) return shared;

    const pending = fetchSession(session);
    inflight.set(session, pending);
    const clearInflight = () => {
      if (inflight.get(session) === pending) inflight.delete(session);
    };
    pending.then(clearInflight, clearInflight);
    return pending;
  };
}
