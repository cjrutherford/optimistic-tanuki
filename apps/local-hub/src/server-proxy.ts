import type { Options } from 'http-proxy-middleware';

export function createSocketIoProxyOptions(gatewayWsUrl: string): Options {
  return {
    // Express strips the mount path; the engine needs it for polling and upgrades.
    target: `${gatewayWsUrl}/socket.io`,
    ws: true,
    changeOrigin: true,
    xfwd: true,
  };
}
