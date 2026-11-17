import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { createServer, Server } from 'node:http';
import { of } from 'rxjs';
import {
  DirectoryController,
  DirectoryOwnerScopeGuard,
} from './directory.controller';
import { AuthGuard } from '../../auth/auth.guard';
import { GATEWAY_APP_REGISTRY } from '../registry/registry.tokens';
import {
  AppScopeCommands,
  RoleCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { directoryPermissionTestProviders } from './directory-permission-test-providers';

describe('boundary decision authenticated HTTP boundary', () => {
  it('rejects anonymous, forged and non-owner sessions and records the verified profile', async () => {
    const jwt = new JwtService({
      secret: 'synthetic-gateway-auth-test-secret',
    });
    const owner = '11111111-1111-4111-8111-111111111111',
      other = '22222222-2222-4222-8222-222222222222';
    const town = '33333333-3333-4333-8333-333333333333',
      decisionSecret = 'synthetic-directory-decision-secret-123456789';
    let received: any;
    const upstream: Server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        if (req.headers.authorization !== `Bearer ${decisionSecret}`) {
          res.writeHead(401).end();
          return;
        }
        received = JSON.parse(body);
        res.writeHead(204).end();
      });
    });
    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', resolve)
    );
    const oldBase = process.env.DIRECTORY_INTERNAL_URL,
      oldSecret = process.env.DIRECTORY_BOUNDARY_DECISION_SECRET;
    process.env.DIRECTORY_INTERNAL_URL = `http://127.0.0.1:${
      (upstream.address() as any).port
    }`;
    process.env.DIRECTORY_BOUNDARY_DECISION_SECRET = decisionSecret;
    const permissions = {
      send: (pattern: any, payload: any) => {
        if (pattern.cmd === AppScopeCommands.GetByName)
          return of({ id: 'scope-owner-console' });
        if (pattern.cmd === RoleCommands.CheckPermission)
          return of(payload.profileId === owner);
        return of(
          payload.profileId === owner
            ? [{ role: { name: 'owner_console_owner' } }]
            : []
        );
      },
    };
    const module = await Test.createTestingModule({
      controllers: [DirectoryController],
      providers: [
        AuthGuard,
        DirectoryOwnerScopeGuard,
        ...directoryPermissionTestProviders,
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
        { provide: GATEWAY_APP_REGISTRY, useValue: { apps: [] } },
      ],
    }).compile();
    const app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    try {
      const port = (app.getHttpServer().address() as any).port,
        url = `http://127.0.0.1:${port}/directory/towns/${town}/boundary-decisions`;
      const candidate = {
        communityId: town,
        changeToken: town,
        geoid: '1323872',
        layer: 'place',
        vintage: '2026',
        stateFips: '13',
        archiveSha256: 'a'.repeat(64),
        geographyHash: 'b'.repeat(64),
      };
      const payload = JSON.stringify({
        requestId: town,
        reviewerId: other,
        decision: 'verified',
        attested: true,
        sourceUrl: 'https://www.census.gov/example',
        candidate,
      });
      const token = (profileId: string) =>
        jwt.sign(
          {
            userId: profileId,
            profileId,
            email: 'test@example.invalid',
            name: 'Synthetic reviewer',
          },
          { expiresIn: '5m' }
        );
      const send = (credential?: string) =>
        fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-ot-appscope': 'owner-console',
            ...(credential ? { authorization: `Bearer ${credential}` } : {}),
          },
          body: payload,
        });
      expect((await send()).status).toBe(401);
      expect((await send('forged')).status).toBe(401);
      expect((await send(token(other))).status).toBe(403);
      expect((await send(token(owner))).status).toBe(201);
      expect(received.reviewerId).toBe(owner);
      expect(received.reviewerId).not.toBe(other);
    } finally {
      await app.close();
      await new Promise<void>((resolve) => upstream.close(() => resolve()));
      if (oldBase === undefined) delete process.env.DIRECTORY_INTERNAL_URL;
      else process.env.DIRECTORY_INTERNAL_URL = oldBase;
      if (oldSecret === undefined)
        delete process.env.DIRECTORY_BOUNDARY_DECISION_SECRET;
      else process.env.DIRECTORY_BOUNDARY_DECISION_SECRET = oldSecret;
    }
  });
});
