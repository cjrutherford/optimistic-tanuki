import { createProxyMiddleware } from 'http-proxy-middleware';
import express from 'express';

export function createGatewayProxy(gatewayUrl: string) {
  return createProxyMiddleware({
    target: gatewayUrl,
    ws: true,
    changeOrigin: true,
    pathRewrite: (_path, req) => (req as express.Request).originalUrl,
  });
}
