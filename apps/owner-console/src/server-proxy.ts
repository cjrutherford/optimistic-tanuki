import type { Options } from 'http-proxy-middleware';

/**
 * The gateway binds login to the registered browser origin and rejects a
 * request whose Host belongs to no registered app. Rewriting Host to the
 * gateway's own address (changeOrigin) made every Owner Console login fail
 * with "App context is not authorized", so the browser Host is kept, as the
 * Local Hub proxy does.
 */
export function createApiProxyOptions(gatewayUrl: string): Options {
  return {
    target: `${gatewayUrl}/api`,
    changeOrigin: false,
    xfwd: true,
    headers: {
      'x-ot-appscope': 'owner-console',
    },
  };
}
