import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createServer, Server } from 'node:http';
import { of } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '../../auth/auth.guard';
import { GATEWAY_APP_REGISTRY } from '../registry/registry.tokens';
import {
  DirectoryController,
  DirectoryOwnerScopeGuard,
} from './directory.controller';
import { DirectoryBusinessLinkController } from './directory-business-link.controller';
import { ServiceTokens } from '@optimistic-tanuki/constants';

const town = '33333333-3333-4333-8333-333333333333',
  otherTown = '66666666-6666-4666-8666-666666666666',
  listing = '44444444-4444-4444-8444-444444444444',
  secret = 'synthetic-directory-ids-secret-1234567890',
  internalText = 'pg_catalog stack trace SELECT * FROM directory_row';

describe('directory public ids never leak internals', () => {
  let app: INestApplication;
  let upstream: Server;
  let url: string;
  let upstreamStatus = 200;
  const saved = { ...process.env };

  beforeAll(async () => {
    upstream = createServer((req, res) => {
      // A reference minted for another town is a miss, exactly like an unknown one.
      if (req.url?.includes(`/towns/${otherTown}/`)) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(upstreamStatus, { 'content-type': 'text/plain' });
      res.end(internalText + ' ' + secret);
    });
    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', resolve)
    );
    process.env['DIRECTORY_INTERNAL_URL'] = `http://127.0.0.1:${
      (upstream.address() as { port: number }).port
    }`;
    process.env['DIRECTORY_LOCAL_EVALUATION'] = 'true';
    process.env['DIRECTORY_LOCAL_EVALUATION_SECRET'] = secret;
    process.env['DIRECTORY_BUSINESS_LINK_SECRET'] = secret + 'x';
    const module = await Test.createTestingModule({
      controllers: [DirectoryController, DirectoryBusinessLinkController],
      providers: [
        AuthGuard,
        DirectoryOwnerScopeGuard,
        { provide: JwtService, useValue: new JwtService({ secret: 'x' }) },
        {
          provide: ServiceTokens.AUTHENTICATION_SERVICE,
          useValue: { send: () => of({ isValid: false }) },
        },
        {
          provide: ServiceTokens.PERMISSIONS_SERVICE,
          useValue: { send: () => of([]) },
        },
        { provide: GATEWAY_APP_REGISTRY, useValue: { apps: [] } },
        {
          provide: ServiceTokens.SOCIAL_SERVICE,
          useValue: { send: () => of(null) },
        },
        {
          provide: ServiceTokens.PAYMENTS_SERVICE,
          useValue: { send: () => of(null) },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${
      (app.getHttpServer().address() as { port: number }).port
    }`;
  });
  afterAll(async () => {
    await app.close();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    process.env = saved;
  });

  const get = async (path: string) => {
    const res = await fetch(url + path);
    return {
      status: res.status,
      cacheControl: res.headers.get('cache-control'),
      text: await res.text(),
    };
  };
  const noLeak = (text: string) => {
    expect(text).not.toContain(internalText);
    expect(text).not.toContain(secret);
    expect(text).not.toContain('127.0.0.1');
    expect(text).not.toMatch(/directory_row|pg_catalog|\bat \S+\.ts/);
  };

  it.each([
    [
      'malformed town',
      '/directory/towns/not-a-uuid/local-evaluation-listings/abc',
    ],
    [
      'oversized reference',
      `/directory/towns/${town}/local-evaluation-listings/${'a'.repeat(2049)}`,
    ],
    [
      'reference with illegal characters',
      `/directory/towns/${town}/local-evaluation-listings/a%20b%3Bc`,
    ],
    [
      'bad adult choice',
      `/directory/towns/${town}/local-evaluation-listings/abc?adult=0`,
    ],
    ['bad list town', '/directory/towns/zzz/local-evaluation-listings'],
    [
      'bad cursor mode',
      `/directory/towns/${town}/local-evaluation-listings?cursor=abc`,
    ],
    [
      'malformed link listing id',
      `/directory/towns/${town}/local-evaluation-listings/xyz/business-link`,
    ],
    [
      'malformed link town',
      `/directory/towns/nope/local-evaluation-listings/${listing}/business-link`,
    ],
  ])('%s is a clean 400', async (_name, path) => {
    const res = await get(path);
    expect(res.status).toBe(400);
    expect(res.cacheControl).toBe('no-store');
    noLeak(res.text);
  });

  it('a reference or id minted for another town is a plain 404', async () => {
    for (const reference of ['abc_DEF-123', listing]) {
      const res = await get(
        `/directory/towns/${otherTown}/local-evaluation-listings/${reference}`
      );
      expect(res.status).toBe(404);
      expect(res.cacheControl).toBe('no-store');
      noLeak(res.text);
      expect(res.text).toContain('Listing unavailable');
    }
  });

  it.each([500, 502, 200])(
    'an upstream %s with internal text becomes a generic 503',
    async (status) => {
      upstreamStatus = status;
      for (const path of [
        `/directory/towns/${town}/local-evaluation-listings/abc`,
        `/directory/towns/${town}/local-evaluation-listings`,
        `/directory/towns/${town}/local-evaluation-listings/${listing}/business-link`,
      ]) {
        const res = await get(path);
        expect(res.status).toBe(503);
        expect(res.cacheControl).toBe('no-store');
        noLeak(res.text);
      }
      upstreamStatus = 200;
    }
  );
});
