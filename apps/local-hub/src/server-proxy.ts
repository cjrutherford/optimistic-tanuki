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
    // Express strips the mount path; the engine needs it for polling and upgrades.
    target: `${gatewayWsUrl}/socket.io`,
    ws: true,
    changeOrigin: true,
    xfwd: true,
  };
}
