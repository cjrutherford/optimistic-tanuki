/** @jest-environment node */
import express from 'express';
import { createServer, request, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createApiProxyOptions } from './server-proxy';

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

interface SeenRequest {
  url: string;
  host: string;
  appScope: string;
}

describe('Owner Console API proxy', () => {
  it('keeps the browser Host so the gateway can bind login to the origin', async () => {
    const seen: SeenRequest = { url: '', host: '', appScope: '' };
    const gateway = createServer((req, res) => {
      seen.url = req.url || '';
      seen.host = req.headers.host || '';
      seen.appScope = String(req.headers['x-ot-appscope'] || '');
      res.end('{}');
    });
    const gatewayUrl = await listen(gateway);
    const app = express();
    app.use('/api', createProxyMiddleware(createApiProxyOptions(gatewayUrl)));
    const frontend = createServer(app);
    const frontendUrl = new URL(await listen(frontend));
    try {
      const status = await new Promise<number>((resolve, reject) => {
        request(
          {
            host: frontendUrl.hostname,
            port: frontendUrl.port,
            path: '/api/authentication/session',
            headers: { host: 'owner.example.test:8446' },
          },
          (res) => {
            res.resume();
            res.on('end', () => resolve(res.statusCode || 0));
          }
        )
          .on('error', reject)
          .end();
      });
      expect(status).toBe(200);
      expect(seen.url).toBe('/api/authentication/session');
      expect(seen.host).toBe('owner.example.test:8446');
      expect(seen.appScope).toBe('owner-console');
    } finally {
      await new Promise((resolve) => frontend.close(resolve));
      await new Promise((resolve) => gateway.close(resolve));
    }
  });
});
