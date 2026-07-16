import type { Options } from 'http-proxy-middleware';

export function createSocketIoProxyOptions(gatewayWsUrl: string): Options {
  return {
    target: `${gatewayWsUrl}/socket.io`,
    ws: true,
    changeOrigin: true,
    xfwd: true,
  };
}
