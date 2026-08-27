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
}

const DEFAULT_SESSION_VALIDATION_TIMEOUT_MS = 3000;

/**
 * Validates the opaque browser session with the gateway. Forge deliberately
 * does not decode, inspect, or accept a bearer substitute for this cookie.
 */
export function createGatewaySessionValidator({
  gatewayUrl,
  fetch: fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_SESSION_VALIDATION_TIMEOUT_MS,
}: GatewaySessionValidatorOptions) {
  const sessionUrl = `${gatewayUrl.replace(
    /\/$/,
    ''
  )}/api/authentication/session`;

  return async (request: ServerSessionRequest): Promise<boolean> => {
    const session = request.cookies?.['ot_session'];
    if (typeof session !== 'string' || session.length === 0) {
      return false;
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);
    try {
      const response = await fetchImpl(sessionUrl, {
        method: 'GET',
        headers: { Cookie: `ot_session=${encodeURIComponent(session)}` },
        signal: abortController.signal,
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  };
}
