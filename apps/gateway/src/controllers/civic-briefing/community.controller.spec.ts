import {
  ForbiddenException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { CommunityCommands } from '@optimistic-tanuki/civic-community';
import { AppScopeCommands, RoleCommands } from '@optimistic-tanuki/constants';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import type { UserDetails } from '../../decorators/user.decorator';
import { CivicCommunityController } from './community.controller';

interface Sent {
  cmd: string;
  payload: Record<string, unknown>;
}

interface Fixture {
  controller: CivicCommunityController;
  contributions: Sent[];
  permissions: Sent[];
}

const user: UserDetails = {
  userId: 'user-1',
  profileId: 'profile-1',
  name: 'Ada',
  email: 'ada@example.com',
  emailVerified: true,
  iat: 0,
  exp: 0,
};

const assignment = (
  role: string,
  permissions: string[],
  scope = 'local-hub'
) => ({
  role: { name: role, permissions: permissions.map((name) => ({ name })) },
  appScope: { name: scope },
});

function fixture(
  options: {
    roles?: unknown;
    rolesFail?: boolean;
    reply?: (cmd: string) => unknown;
  } = {}
): Fixture {
  const contributions: Sent[] = [];
  const permissions: Sent[] = [];
  const contributionsClient = {
    send: jest.fn(
      (pattern: { cmd: string }, payload: Record<string, unknown>) => {
        contributions.push({ cmd: pattern.cmd, payload });
        return of(options.reply?.(pattern.cmd) ?? null);
      }
    ),
  };
  const permissionsClient = {
    send: jest.fn(
      (pattern: { cmd: string }, payload: Record<string, unknown>) => {
        permissions.push({ cmd: pattern.cmd, payload });
        if (pattern.cmd === RoleCommands.GetUserRoles) {
          return options.rolesFail
            ? throwError(() => new Error('permissions down'))
            : of(
                options.roles ?? [
                  assignment('local_hub_contributor', ['contribution.create']),
                  assignment('global_admin', ['x.y'], 'global'),
                ]
              );
        }
        if (pattern.cmd === AppScopeCommands.GetByName)
          return of({ id: 'scope-1' });
        if (pattern.cmd === RoleCommands.GetByName) return of({ id: 'role-1' });
        return of({});
      }
    ),
  };
  const profilesClient = { send: jest.fn(() => of([{ bio: 'Hello' }])) };
  return {
    controller: new CivicCommunityController(
      contributionsClient as never,
      permissionsClient as never,
      profilesClient as never
    ),
    contributions,
    permissions,
  };
}

const metadata = (name: keyof CivicCommunityController, key: string) =>
  Reflect.getMetadata(key, CivicCommunityController.prototype[name]);

describe('CivicCommunityController', () => {
  it('sends the actor with its local-hub roles only', async () => {
    const { controller, contributions } = fixture({ reply: () => [] });
    await controller.mine(user);
    expect(contributions).toEqual([
      {
        cmd: CommunityCommands.Mine,
        payload: {
          actor: {
            userId: 'user-1',
            profileId: 'profile-1',
            handle: 'Ada',
            roles: ['local_hub_contributor'],
          },
        },
      },
    ]);
  });

  it('asks for roles in the local-hub scope', async () => {
    const { controller, permissions } = fixture({ reply: () => [] });
    await controller.mine(user);
    expect(permissions[0]).toEqual({
      cmd: RoleCommands.GetUserRoles,
      payload: { profileId: 'profile-1', appScope: 'local-hub' },
    });
  });

  it('answers 503 and calls nothing when the role lookup fails', async () => {
    const { controller, contributions } = fixture({ rolesFail: true });
    await expect(controller.mine(user)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    await expect(
      controller.withdraw(user, '0b5f1c28-5b0e-4c61-9f27-5a3c1d4e8f10')
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      controller.applyOfficial(user, { localitySlug: 'tifton-ga' })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(contributions).toEqual([]);
  });

  it('refuses an account with no profile', async () => {
    const { controller, contributions } = fixture();
    await expect(
      controller.mine({ ...user, profileId: '' })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(contributions).toEqual([]);
  });

  it('submits with roles, origin and the email verification', async () => {
    const { controller, contributions } = fixture({
      reply: () => ({ contribution: { id: 'c1' } }),
    });
    const raw = JSON.stringify({
      localitySlug: 'tifton-ga',
      kind: 'account',
      subject: { kind: 'other', text: 'Pothole' },
      body: 'I saw it.',
      links: [],
      representations: { witnessed: true, ownWords: true },
    });
    const result = await controller.submit(
      user,
      raw,
      undefined,
      { ip: '10.1.2.3', headers: { 'user-agent': 'ua' } } as never,
      'idem-key-12345'
    );
    expect(result).toEqual({ data: { id: 'c1' } });
    expect(contributions[0].cmd).toBe(CommunityCommands.Submit);
    expect(contributions[0].payload).toMatchObject({
      actor: { roles: ['local_hub_contributor'] },
      idempotencyKey: 'idem-key-12345',
      emailVerified: true,
      attachment: null,
      origin: null,
    });
  });

  it('refuses an attachment without artifact.upload', async () => {
    const { controller, contributions } = fixture();
    const raw = JSON.stringify({
      localitySlug: 'tifton-ga',
      kind: 'artifact',
      subject: { kind: 'other', text: 'Doc' },
      body: 'Here.',
      links: [],
      representations: {},
    });
    await expect(
      controller.submit(
        user,
        raw,
        { originalname: 'a.pdf', buffer: Buffer.from('x') },
        { headers: {} } as never
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(contributions).toEqual([]);
  });

  it('turns a refused submission into a 422 with its reasons', async () => {
    const { controller } = fixture({
      reply: () => ({
        refused: { stage: 'floor', reasons: ['Verify email.'] },
      }),
    });
    const raw = JSON.stringify({
      localitySlug: 'tifton-ga',
      kind: 'account',
      subject: { kind: 'other', text: 'x' },
      body: 'b',
      links: [],
      representations: {},
    });
    await expect(
      controller.submit(user, raw, undefined, { headers: {} } as never)
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('assigns local_hub_verified_official in local-hub when an official is granted', async () => {
    const { controller, permissions } = fixture({
      reply: () => ({
        granted: true,
        standing: 'submitting-official',
        reasons: [],
        office: 'Mayor',
      }),
    });
    await controller.applyOfficial(user, { localitySlug: 'tifton-ga' });
    expect(permissions.map((p) => p.cmd)).toEqual([
      RoleCommands.GetUserRoles,
      AppScopeCommands.GetByName,
      RoleCommands.GetByName,
      RoleCommands.Assign,
    ]);
    expect(permissions[2].payload).toEqual({
      name: 'local_hub_verified_official',
      appScope: 'local-hub',
    });
    expect(permissions[3].payload).toEqual({
      roleId: 'role-1',
      profileId: 'profile-1',
      appScopeId: 'scope-1',
    });
  });

  it('refuses contributor sign-up until the email address is verified (D27)', async () => {
    const { controller, permissions } = fixture();
    const unverified = { ...user, emailVerified: false };
    const refusal = await controller
      .signUpAsContributor(unverified, { agreeToTerms: true })
      .catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(ForbiddenException);
    expect((refusal as ForbiddenException).getResponse()).toMatchObject({
      code: 'EMAIL_VERIFICATION_REQUIRED',
    });
    expect(permissions).toEqual([]);
  });

  it('grants local_hub_contributor on sign-up and returns the new standing', async () => {
    const { controller, permissions } = fixture({
      roles: [
        assignment('local_hub_contributor', [
          'briefing.read',
          'contribution.create',
        ]),
      ],
    });
    const result = await controller.signUpAsContributor(user, {
      agreeToTerms: true,
    });
    expect(permissions.map((p) => p.cmd)).toEqual([
      AppScopeCommands.GetByName,
      RoleCommands.GetByName,
      RoleCommands.Assign,
      RoleCommands.GetUserRoles,
    ]);
    expect(permissions[1].payload).toEqual({
      name: 'local_hub_contributor',
      appScope: 'local-hub',
    });
    expect(result.data).toMatchObject({
      roles: ['local_hub_contributor'],
      permissions: ['briefing.read', 'contribution.create'],
    });
  });

  it('assigns nothing when the application is not granted', async () => {
    const { controller, permissions } = fixture({
      reply: () => ({
        granted: false,
        standing: 'none',
        reasons: ['no'],
        office: null,
      }),
    });
    await controller.applyOfficial(user, { localitySlug: 'tifton-ga' });
    expect(permissions.map((p) => p.cmd)).toEqual([RoleCommands.GetUserRoles]);
  });

  it('reports the account standing', async () => {
    const { controller } = fixture();
    expect(await controller.me(user)).toEqual({
      data: {
        profileId: 'profile-1',
        handle: 'Ada',
        emailVerified: true,
        roles: ['local_hub_contributor'],
        permissions: ['contribution.create'],
      },
    });
  });

  it('shows a contributor page with the bio and without the profile id', async () => {
    const { controller } = fixture({
      reply: () => ({ id: 'k1', handle: 'Ada', profileId: 'p9', reports: [] }),
    });
    const result = await controller.contributor(
      '0b5f1c28-5b0e-4c61-9f27-5a3c1d4e8f10'
    );
    expect(result.data).toEqual({
      id: 'k1',
      handle: 'Ada',
      reports: [],
      bio: 'Hello',
    });
  });

  describe('metadata', () => {
    it.each([
      ['subjects', 'contribution.create'],
      ['submit', 'contribution.create'],
      ['withdraw', 'contribution.withdraw'],
      ['mine', 'contribution.read'],
    ] as const)('%s requires %s', (route, permission) => {
      expect(metadata(route, PERMISSIONS_KEY)).toEqual({
        permissions: [permission],
      });
    });

    it.each(['surface', 'contributor', 'artifact', 'fileNotice'] as const)(
      '%s is public',
      (route) => {
        expect(metadata(route, IS_PUBLIC_KEY)).toBe(true);
      }
    );

    it.each([
      'mine',
      'applyOfficial',
      'counterNotice',
      'me',
      'submit',
    ] as const)('%s is not public', (route) => {
      expect(metadata(route, IS_PUBLIC_KEY)).toBeUndefined();
    });
  });
});
