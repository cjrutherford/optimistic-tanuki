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

function gatewayCredentialHeaders(
  request: ServerSessionRequest
): Record<string, string> | undefined {
  const session = request.cookies?.['ot_session'];
  if (typeof session === 'string' && session.length > 0) {
    return { Cookie: `ot_session=${encodeURIComponent(session)}` };
  }

  const legacySession = request.cookies?.['ot-local-hub-authToken'];
  if (typeof legacySession === 'string' && legacySession.length > 0) {
    return { Authorization: `Bearer ${legacySession}` };
  }

  const authorization = request.headers?.authorization;
  if (
    typeof authorization === 'string' &&
    /^Bearer\s+\S+$/i.test(authorization)
  ) {
    return { Authorization: authorization };
  }

  return undefined;
}

/**
 * Validates SSR credentials through the gateway's guarded session endpoint.
 * The local server never decodes a browser credential itself, so expired,
 * forged, or revoked sessions fail closed before protected HTML is rendered.
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
    const headers = gatewayCredentialHeaders(request);
    if (!headers) {
      return false;
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);
    try {
      const response = await fetchImpl(sessionUrl, {
        method: 'GET',
        headers,
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
