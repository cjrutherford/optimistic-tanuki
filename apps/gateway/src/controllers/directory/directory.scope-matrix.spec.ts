import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { createServer, Server } from 'node:http';
import { of } from 'rxjs';
import {
  DirectoryController,
  DirectoryOwnerScopeGuard,
} from './directory.controller';
import {
  DirectoryBusinessLinkController,
  DirectoryBusinessLinkQueueController,
} from './directory-business-link.controller';
import { DirectoryAddressReviewController } from './directory-address-review.controller';
import { DirectoryListingSuppressionController } from './directory-listing-suppression.controller';
import {
  DirectoryListingReportController,
  DirectoryListingReportReviewController,
} from './directory-listing-report.controller';
import { DirectoryBusinessIdentityReviewController } from './directory-business-identity-review.controller';
import { AuthGuard } from '../../auth/auth.guard';
import { GATEWAY_APP_REGISTRY } from '../registry/registry.tokens';
import {
  AppScopeCommands,
  RoleCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { DIRECTORY_PERMISSIONS } from '@optimistic-tanuki/social-contracts';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';

interface MatrixRoute {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
}

const town = '33333333-3333-4333-8333-333333333333',
  listing = '44444444-4444-4444-8444-444444444444',
  candidate = '55555555-5555-4555-8555-555555555555',
  owner = '11111111-1111-4111-8111-111111111111',
  member = '22222222-2222-4222-8222-222222222222',
  unpermitted = '66666666-6666-4666-8666-666666666666',
  secret = 'synthetic-directory-matrix-secret-123456789',
  base = `/directory/towns/${town}`;

// Public local-evaluation reads: reachable without any session.
const publicReads: MatrixRoute[] = [
  { method: 'GET', path: `${base}/local-evaluation-listings` },
  {
    method: 'GET',
    path: `${base}/local-evaluation-listings/${listing}/business-link`,
  },
];
// Requires a session but not Owner Console scope.
const sessionOnly: MatrixRoute[] = [
  {
    method: 'POST',
    path: `${base}/local-evaluation-listings/${listing}/business-link/requests`,
    body: {},
  },
  {
    method: 'GET',
    path: `${base}/local-evaluation-listings/${listing}/business-link/mine`,
  },
  {
    method: 'POST',
    path: `${base}/local-evaluation-listings/${listing}/business-link/revoke`,
    body: {},
  },
];
// Review surfaces: session AND x-ot-appscope: owner-console.
const reviewRoutes: MatrixRoute[] = [
  {
    method: 'GET',
    path: `${base}/local-evaluation-listings/${listing}/business-link/requests`,
  },
  {
    method: 'POST',
    path: `${base}/local-evaluation-listings/${listing}/business-link/reviews`,
    body: {},
  },
  { method: 'GET', path: `${base}/business-link-requests` },
  { method: 'GET', path: `${base}/address-review-candidates` },
  {
    method: 'POST',
    path: `${base}/address-review-candidates/${candidate}/decisions`,
    body: {},
  },
  { method: 'GET', path: `${base}/address-review-candidates/${candidate}` },
  {
    method: 'POST',
    path: `${base}/address-review-candidates/${candidate}/undo`,
    body: {},
  },
  { method: 'GET', path: `${base}/business-identity-review` },
  {
    method: 'POST',
    path: `${base}/business-identity-review/decisions`,
    body: {},
  },
  { method: 'GET', path: `${base}/business-identity-review/${candidate}` },
  {
    method: 'POST',
    path: `${base}/business-identity-review/${candidate}/undo`,
    body: {},
  },
  { method: 'GET', path: `${base}/listing-suppressions` },
  { method: 'POST', path: `${base}/listing-suppressions`, body: {} },
  {
    method: 'POST',
    path: `${base}/listing-suppressions/${candidate}/lift`,
    body: {},
  },
  { method: 'GET', path: `${base}/listing-reports` },
  {
    method: 'POST',
    path: `${base}/listing-reports/${candidate}/review`,
    body: {},
  },
  { method: 'GET', path: `${base}/boundary-candidate` },
  { method: 'POST', path: `${base}/boundary-decisions`, body: {} },
];

describe('directory authentication and Owner Console scope matrix', () => {
  let app: INestApplication;
  let upstream: Server;
  let url: string;
  const jwt = new JwtService({ secret: 'synthetic-gateway-matrix-secret' });
  const saved = { ...process.env };
  const token = (profileId: string) =>
    jwt.sign(
      { userId: profileId, profileId, email: 'a@example.invalid', name: 'T' },
      { expiresIn: '5m' }
    );

  beforeAll(async () => {
    upstream = createServer((req, res) => {
      res.setHeader('content-type', 'application/json');
      if (req.url?.includes('/listings?'))
        res.end(JSON.stringify({ listings: [], hasMore: false }));
      else if (req.url?.includes('/business-links/'))
        res.end(JSON.stringify({ link: null }));
      else res.end('{}');
    });
    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', resolve)
    );
    process.env['DIRECTORY_INTERNAL_URL'] = `http://127.0.0.1:${
      (upstream.address() as { port: number }).port
    }`;
    process.env['DIRECTORY_LOCAL_EVALUATION'] = 'true';
    for (const name of [
      'DIRECTORY_LOCAL_EVALUATION_SECRET',
      'DIRECTORY_BUSINESS_LINK_SECRET',
      'DIRECTORY_BOUNDARY_DECISION_SECRET',
      'DIRECTORY_BOUNDARY_REVIEW_SECRET',
    ])
      process.env[name] = secret + name.length;
    const permissions = {
      send: (
        pattern: { cmd?: string },
        payload: { profileId?: string; permission?: string }
      ) => {
        if (pattern.cmd === AppScopeCommands.GetByName)
          return of({ id: 'scope-owner-console' });
        if (pattern.cmd === RoleCommands.CheckPermission)
          return of(
            payload.profileId === owner &&
              payload.permission === DIRECTORY_PERMISSIONS.review
          );
        return of(
          payload.profileId === owner || payload.profileId === unpermitted
            ? [{ role: { name: 'owner_console_owner' } }]
            : []
        );
      },
    };
    const module = await Test.createTestingModule({
      controllers: [
        DirectoryController,
        DirectoryBusinessLinkController,
        DirectoryBusinessLinkQueueController,
        DirectoryAddressReviewController,
        DirectoryBusinessIdentityReviewController,
        DirectoryListingSuppressionController,
        DirectoryListingReportController,
        DirectoryListingReportReviewController,
      ],
      providers: [
        AuthGuard,
        DirectoryOwnerScopeGuard,
        PermissionsGuard,
        { provide: Logger, useValue: new Logger('matrix') },
        {
          provide: PermissionsCacheService,
          useValue: {
            getOrLoad: (
              _profile: string,
              _permission: string,
              _scope: string,
              _target: string | null,
              load: () => Promise<boolean>
            ) => load(),
          },
        },
        {
          provide: ServiceTokens.PROFILE_SERVICE,
          useValue: { send: () => of([]) },
        },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: JwtService, useValue: jwt },
        {
          provide: ServiceTokens.AUTHENTICATION_SERVICE,
          useValue: { send: () => of({ isValid: true, emailVerified: true }) },
        },
        { provide: ServiceTokens.PERMISSIONS_SERVICE, useValue: permissions },
        {
          provide: ServiceTokens.SOCIAL_SERVICE,
          useValue: { send: () => of(null) },
        },
        {
          provide: ServiceTokens.PAYMENTS_SERVICE,
          useValue: { send: () => of(null) },
        },
        { provide: GATEWAY_APP_REGISTRY, useValue: { apps: [] } },
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

  const call = async (
    route: MatrixRoute,
    opts: { token?: string; scope?: boolean } = {}
  ) => {
    const res = await fetch(url + route.path, {
      method: route.method,
      headers: {
        'content-type': 'application/json',
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.scope ? { 'x-ot-appscope': 'owner-console' } : {}),
      },
      ...(route.method === 'POST' ? { body: JSON.stringify(route.body) } : {}),
    });
    await res.text();
    return res;
  };

  it.each(publicReads.map((r) => [r.method + ' ' + r.path, r] as const))(
    'anonymous reads %s succeed with no-store',
    async (_name, route) => {
      const res = await call(route);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  );

  it('anonymous listing reports and receipt lookups are never auth-rejected', async () => {
    const created = await call({
      method: 'POST',
      path: `${base}/listing-reports`,
      body: { listingId: listing, reasonCode: 'other', website: 'bot' },
    });
    expect(created.status).toBe(201);
    expect(created.headers.get('cache-control')).toBe('no-store');
    const looked = await call({
      method: 'GET',
      path: `/directory/listing-reports/${'a'.repeat(32)}`,
    });
    expect([401, 403]).not.toContain(looked.status);
    expect(looked.headers.get('cache-control')).toBe('no-store');
  });

  it('an anonymous listing detail is never auth-rejected', async () => {
    const res = await call({
      method: 'GET',
      path: `${base}/local-evaluation-listings/${listing}`,
    });
    expect([401, 403]).not.toContain(res.status);
  });

  it.each(
    [...sessionOnly, ...reviewRoutes].map(
      (r) => [r.method + ' ' + r.path, r] as const
    )
  )(
    'anonymous %s is 401, even with the owner scope header',
    async (_n, route) => {
      expect((await call(route)).status).toBe(401);
      expect((await call(route, { scope: true })).status).toBe(401);
      expect((await call(route, { token: 'forged', scope: true })).status).toBe(
        401
      );
    }
  );

  it.each(reviewRoutes.map((r) => [r.method + ' ' + r.path, r] as const))(
    'authenticated %s without owner-console scope is 403',
    async (_n, route) => {
      // Even a session holding an owner role is refused without the scope header.
      expect((await call(route, { token: token(owner) })).status).toBe(403);
      expect((await call(route, { token: token(member) })).status).toBe(403);
      // With the header, a session lacking the owner role is still refused.
      expect(
        (await call(route, { token: token(member), scope: true })).status
      ).toBe(403);
      // The owner with the header passes both guards.
      const ok = await call(route, { token: token(owner), scope: true });
      expect([401, 403]).not.toContain(ok.status);
    }
  );

  it.each(reviewRoutes.map((r) => [r.method + ' ' + r.path, r] as const))(
    'owner-console session without directory.review gets 403 on %s',
    async (_n, route) => {
      // Passes AuthGuard and the scope guard (owner role, header) but lacks the permission.
      const res = await call(route, { token: token(unpermitted), scope: true });
      expect(res.status).toBe(403);
      const granted = await call(route, { token: token(owner), scope: true });
      expect([401, 403]).not.toContain(granted.status);
    }
  );

  it.each(sessionOnly.map((r) => [r.method + ' ' + r.path, r] as const))(
    'authenticated %s needs a session but not owner-console scope',
    async (_n, route) => {
      const res = await call(route, { token: token(member) });
      expect([401, 403]).not.toContain(res.status);
    }
  );
});
