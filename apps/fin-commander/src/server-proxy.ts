import type { Request } from 'express';
import type { Options } from 'http-proxy-middleware';

export function createApiProxyOptions(gatewayUrl: string): Options {
  return {
    target: gatewayUrl,
    changeOrigin: false,
    ws: true,
    pathRewrite: (_path, req) => (req as Request).originalUrl,
  };
}
