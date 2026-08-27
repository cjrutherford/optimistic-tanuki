/**
 * Turns the gateway address `server.ts` already resolves for its `/api`
 * proxy into the absolute base URL Angular's `HttpClient` needs for
 * server-side requests.
 *
 * Kept as one function so the server render and the proxy read the exact
 * same `GATEWAY_URL`, rather than each hardcoding their own copy of it.
 */
export const getServerApiBaseUrl = (gatewayUrl: string): string =>
  `${gatewayUrl.replace(/\/$/, '')}/api`;
