/** @jest-environment node */
import express from 'express';
import { createServer, get, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { createProxyMiddleware } from 'http-proxy-middleware';
import {
  createApiProxyOptions,
  createSocketIoProxyOptions,
} from './server-proxy';

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('Local Hub Socket.IO proxy', () => {
  it('preserves the engine mount path and polling query at the gateway', async () => {
    let receivedPath = '';
    const gateway = createServer((req, res) => {
      receivedPath = req.url || '';
      res.statusCode = receivedPath.startsWith('/socket.io/') ? 200 : 404;
      res.end(res.statusCode === 200 ? '0{"sid":"fixture"}' : '');
    });
    const gatewayUrl = await listen(gateway);
    const app = express();
    app.use(
      '/socket.io',
      createProxyMiddleware(createSocketIoProxyOptions(gatewayUrl))
    );
    const frontend = createServer(app);
    const frontendUrl = await listen(frontend);
    try {
      const response = await new Promise<{ status: number; body: string }>(
        (resolve, reject) => {
          get(`${frontendUrl}/socket.io/?EIO=4&transport=polling`, (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => resolve({ status: res.statusCode || 0, body }));
          }).on('error', reject);
        }
      );
      expect(response.status).toBe(200);
      expect(response.body).toBe('0{"sid":"fixture"}');
      expect(receivedPath).toBe('/socket.io/?EIO=4&transport=polling');
    } finally {
      await Promise.all(
        [frontend, gateway].map(
          (server) =>
            new Promise<void>((resolve) => server.close(() => resolve()))
        )
      );
    }
  });
});

describe('Local Hub API proxy', () => {
  it('preserves the registered browser host for Gateway origin authorization', () => {
    const options = createApiProxyOptions('http://127.0.0.1:18880');
    expect(options.target).toBe('http://127.0.0.1:18880/api');
    expect(options.changeOrigin).toBe(false);
    expect(options.xfwd).toBe(true);
  });
});
