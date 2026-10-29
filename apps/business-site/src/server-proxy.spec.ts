import { shouldPreserveClientHost } from './server-proxy';
import { createBusinessApiProxy } from './server-proxy';
import express from 'express';
import http from 'node:http';

describe('shouldPreserveClientHost', () => {
  it('preserves the browser origin for the OAuth redeem endpoint', () => {
    // The gateway redeem check requires Origin to equal the grant's app
    // origin. Rewriting it to the gateway origin 401s every business-site
    // OAuth redeem and bounces the login back to /login.
    expect(shouldPreserveClientHost('/api/oauth/callback/redeem')).toBe(true);
  });

  it('preserves the browser origin for all OAuth API paths', () => {
    expect(shouldPreserveClientHost('/api/oauth/start/google')).toBe(true);
    expect(shouldPreserveClientHost('/api/oauth/callback/google')).toBe(true);
    expect(
      shouldPreserveClientHost('/api/oauth/config?domain=example.com')
    ).toBe(true);
    expect(shouldPreserveClientHost('/api/oauth')).toBe(true);
  });

  it('also matches mount-stripped OAuth paths seen inside the proxy hook', () => {
    expect(shouldPreserveClientHost('/oauth/callback/redeem')).toBe(true);
    expect(shouldPreserveClientHost('/oauth')).toBe(true);
    expect(shouldPreserveClientHost('/oauth/start/google')).toBe(true);
  });

  it('preserves the registered public authority for authentication paths', () => {
    expect(shouldPreserveClientHost('/api/authentication/session')).toBe(true);
    expect(shouldPreserveClientHost('/api/authentication/login')).toBe(true);
    expect(shouldPreserveClientHost('/authentication/login')).toBe(true);
  });

  it('keeps the existing gateway-origin rewrite for other API paths', () => {
    expect(shouldPreserveClientHost('/api/profiles')).toBe(false);
    expect(shouldPreserveClientHost('/api/')).toBe(false);
  });
});

describe('Business API proxy HTTP boundary', () => {
  it('forwards authentication path, parsed body, public Host and Origin', async () => {
    let observed:
      | { url?: string; host?: string; origin?: string; body: string }
      | undefined;
    const gateway = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      req.on('end', () => {
        observed = {
          url: req.url,
          host: req.headers.host,
          origin: req.headers.origin,
          body: Buffer.concat(chunks).toString(),
        };
        res.statusCode = 201;
        res.end('ok');
      });
    });
    await new Promise<void>((resolve) =>
      gateway.listen(0, '127.0.0.1', resolve)
    );
    const gatewayAddress = gateway.address();
    if (!gatewayAddress || typeof gatewayAddress === 'string') {
      throw new Error('No gateway test port');
    }
    const gatewayUrl = `http://127.0.0.1:${gatewayAddress.port}`;
    const app = express();
    app.use(express.json());
    app.use('/api', createBusinessApiProxy(gatewayUrl));
    const frontend = http.createServer(app);
    await new Promise<void>((resolve) =>
      frontend.listen(0, '127.0.0.1', resolve)
    );
    const frontendAddress = frontend.address();
    if (!frontendAddress || typeof frontendAddress === 'string') {
      throw new Error('No frontend test port');
    }

    try {
      const result = await new Promise<{ status: number; body: string }>(
        (resolve, reject) => {
          const req = http.request(
            {
              host: '127.0.0.1',
              port: frontendAddress.port,
              path: '/api/authentication/register',
              method: 'POST',
              headers: {
                host: 'business.example.test:8094',
                origin: 'http://business.example.test:8094',
                'content-type': 'application/json',
              },
            },
            (res) => {
              const chunks: Buffer[] = [];
              res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
              res.on('end', () =>
                resolve({
                  status: res.statusCode || 0,
                  body: Buffer.concat(chunks).toString(),
                })
              );
            }
          );
          req.on('error', reject);
          req.end('{"email":"owner@example.test"}');
        }
      );
      expect(result).toEqual({ status: 201, body: 'ok' });
      expect(observed).toEqual({
        url: '/api/authentication/register',
        host: 'business.example.test:8094',
        origin: 'http://business.example.test:8094',
        body: '{"email":"owner@example.test"}',
      });
    } finally {
      await Promise.all([
        new Promise<void>((resolve, reject) =>
          frontend.close((error) => (error ? reject(error) : resolve()))
        ),
        new Promise<void>((resolve, reject) =>
          gateway.close((error) => (error ? reject(error) : resolve()))
        ),
      ]);
    }
  });

  it('forwards ordinary API origins unchanged while routing Host to the gateway', async () => {
    const observed: Array<{ url?: string; host?: string; origin?: string }> =
      [];
    const gateway = http.createServer((req, res) => {
      observed.push({
        url: req.url,
        host: req.headers.host,
        origin: req.headers.origin,
      });
      res.end('ok');
    });
    await new Promise<void>((resolve) =>
      gateway.listen(0, '127.0.0.1', resolve)
    );
    const gatewayAddress = gateway.address();
    if (!gatewayAddress || typeof gatewayAddress === 'string') {
      throw new Error('No gateway test port');
    }
    const app = express();
    app.use(
      '/api',
      createBusinessApiProxy(`http://127.0.0.1:${gatewayAddress.port}`)
    );
    const frontend = http.createServer(app);
    await new Promise<void>((resolve) =>
      frontend.listen(0, '127.0.0.1', resolve)
    );
    const frontendAddress = frontend.address();
    if (!frontendAddress || typeof frontendAddress === 'string') {
      throw new Error('No frontend test port');
    }

    const send = (origin: string) =>
      new Promise<void>((resolve, reject) => {
        const req = http.request(
          {
            host: '127.0.0.1',
            port: frontendAddress.port,
            path: '/api/profiles?limit=2',
            headers: {
              host: 'business.example.test:8094',
              origin,
            },
          },
          (res) => {
            res.resume();
            res.on('end', resolve);
          }
        );
        req.on('error', reject);
        req.end();
      });

    try {
      await send('http://business.example.test:8094');
      await send('https://unregistered.example.test');
      expect(observed).toEqual([
        {
          url: '/api/profiles?limit=2',
          host: `127.0.0.1:${gatewayAddress.port}`,
          origin: 'http://business.example.test:8094',
        },
        {
          url: '/api/profiles?limit=2',
          host: `127.0.0.1:${gatewayAddress.port}`,
          origin: 'https://unregistered.example.test',
        },
      ]);
    } finally {
      await Promise.all([
        new Promise<void>((resolve, reject) =>
          frontend.close((error) => (error ? reject(error) : resolve()))
        ),
        new Promise<void>((resolve, reject) =>
          gateway.close((error) => (error ? reject(error) : resolve()))
        ),
      ]);
    }
  });
});
