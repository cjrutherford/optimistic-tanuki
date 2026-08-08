import type { Options } from 'http-proxy-middleware';

export function createApiProxyOptions(gatewayUrl: string): Options {
  return {
    target: `${gatewayUrl}/api`,
    changeOrigin: false,
    xfwd: true,
  };
}

export function createSocketIoProxyOptions(gatewayWsUrl: string): Options {
  return {
    // Express removes the `/socket.io` mount path before proxying. Restore it
    // at the gateway target so the Socket.IO engine receives `/socket.io`
    // exactly once for both polling and WebSocket-upgrade requests.
    target: `${gatewayWsUrl}/socket.io`,
    ws: true,
    changeOrigin: true,
    xfwd: true,
  };
}
