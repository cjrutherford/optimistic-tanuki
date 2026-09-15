import express from 'express';
import { createServer, Server } from 'node:http';
import { createGatewayProxy } from './server-proxy';
import { applyPublicAppSecurityHeaders } from './server-security';
import { isBrowserAssetRequest } from './browser-asset-guard';

function listen(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });
}

function request(
  port: number,
  path: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = require('node:http').get(
      { host: '127.0.0.1', port, path },
      (response: import('node:http').IncomingMessage) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (body += chunk));
        response.on('end', () =>
          resolve({ status: response.statusCode ?? 0, body })
        );
      }
    );
    req.on('error', reject);
  });
}

describe('learning SSR API proxy', () => {
  let gateway: Server;
  let proxy: Server;
  const seenPaths: string[] = [];

  beforeEach(async () => {
    gateway = createServer((req, res) => {
      seenPaths.push(req.url ?? '');
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
    });

    const gatewayPort = await listen(gateway);

    const proxyApp = express();
    proxyApp.use(
      ['/api-docs', '/api/learning', '/api/authentication'],
      createGatewayProxy(`http://127.0.0.1:${gatewayPort}`)
    );
    proxyApp.use((_request, response) =>
      response.type('html').send('<html>SPA fallback</html>')
    );
    proxy = await new Promise<Server>((resolve) => {
      const server = proxyApp.listen(0, '127.0.0.1', () => resolve(server));
    });
  });

  describe('learning SSR transport security', () => {
    function headersFor(
      secure: boolean,
      forwardedProto?: string
    ): Record<string, string> {
      const headers: Record<string, string> = {};
      const request = {
        secure,
        get: (name: string) =>
          name.toLowerCase() === 'x-forwarded-proto'
            ? forwardedProto
            : undefined,
      } as unknown as import('express').Request;
      const response = {
        setHeader: (name: string, value: string) => {
          headers[name] = value;
        },
      } as unknown as import('express').Response;

      applyPublicAppSecurityHeaders(request, response, () => undefined);
      return headers;
    }

    it('adds HSTS for a direct HTTPS request', () => {
      expect(headersFor(true)['Strict-Transport-Security']).toBe(
        'max-age=31536000; includeSubDomains'
      );
    });

    it('adds HSTS when HTTPS is forwarded by the edge', () => {
      expect(
        headersFor(false, 'https, http')['Strict-Transport-Security']
      ).toBe('max-age=31536000; includeSubDomains');
    });

    it('does not add HSTS to plain HTTP review traffic', () => {
      expect(headersFor(false)['Strict-Transport-Security']).toBeUndefined();
    });

    it('allows the theme loader’s Google Font stylesheet and font host narrowly', () => {
      const policy = headersFor(false)['Content-Security-Policy'];

      expect(policy).toContain(
        "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com"
      );
      expect(policy).toContain(
        "font-src 'self' data: https://fonts.gstatic.com"
      );
      expect(policy).not.toContain("style-src 'self' 'unsafe-inline' https:");
      expect(policy).not.toContain("font-src 'self' data: https:;");
    });
  });

  afterEach(async () => {
    await Promise.all(
      [gateway, proxy].map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
          )
      )
    );
    seenPaths.length = 0;
  });

  it.each([
    '/api-docs',
    '/api/learning/challenges',
    '/api/authentication/login',
  ])('preserves the original API path for %s', async (path) => {
    const port = (proxy.address() as import('node:net').AddressInfo).port;

    const response = await request(port, path);

    expect(response).toEqual({ status: 200, body: 'ok' });
    expect(seenPaths).toEqual([path]);
  });

  it.each([
    '/main.js',
    '/chunk-ABC123.mjs',
    '/styles.css',
    '/font.woff2',
    '/assets/icon.png',
    '/manifest.webmanifest',
  ])('recognizes browser assets at %s', (path) => {
    expect(isBrowserAssetRequest(path)).toBe(true);
  });

  it('does not classify application routes as browser assets', () => {
    expect(isBrowserAssetRequest('/courses')).toBe(false);
    expect(isBrowserAssetRequest('/api/learning/programs')).toBe(false);
  });
});
