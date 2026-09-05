import { Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { RoleInitService } from './role-init.service';
import {
  AppScopeCommands,
  PermissionCommands,
  RoleCommands,
} from '@optimistic-tanuki/constants';

/**
 * processOne is written to survive a permissions service that is partly
 * unavailable: nearly every call has a catch that logs and carries on, and
 * roles are looked up through a three-step fallback when creation fails.
 * These drive those branches, since in normal operation none of them run.
 */
describe('RoleInitService behaviour', () => {
  type Reply = (payload: Record<string, unknown>) => unknown;

  let handlers: Map<string, Reply>;
  let client: { send: jest.Mock };
  let service: RoleInitService;

  /** Registers the reply for one command; returning undefined means `of(null)`. */
  const on = (cmd: string, reply: Reply) => handlers.set(cmd, reply);

  const sent = (cmd: string) =>
    client.send.mock.calls
      .filter((call) => call[0]?.cmd === cmd)
      .map((call) => call[1]);

  const okScope = () =>
    on(AppScopeCommands.GetByName, () => ({ id: 'scope-1' }));

  beforeEach(() => {
    handlers = new Map();
    client = {
      send: jest.fn((pattern: { cmd: string }, payload) => {
        const handler = handlers.get(pattern.cmd);
        if (!handler) return of(null);
        const result = handler(payload as Record<string, unknown>);
        return result instanceof Error
          ? throwError(() => result)
          : of(result ?? null);
      }),
    };

    service = new RoleInitService(client as unknown as ClientProxy);
    (service as unknown as { logger: Logger }).logger = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger;
  });

  describe('app scope resolution', () => {
    it('uses an existing scope without creating one', async () => {
      okScope();

      await service.processNow({ scopeName: 'social' });

      expect(sent(AppScopeCommands.Create)).toHaveLength(0);
    });

    it('throws when the scope can neither be found nor created', async () => {
      on(AppScopeCommands.GetByName, () => null);
      on(AppScopeCommands.Create, () => null);

      await expect(service.processNow({ scopeName: 'ghost' })).rejects.toThrow(
        'AppScope ghost not found'
      );
    });

    it('throws when both scope calls fail outright', async () => {
      on(AppScopeCommands.GetByName, () => new Error('down'));
      on(AppScopeCommands.Create, () => new Error('down'));

      await expect(service.processNow({ scopeName: 'ghost' })).rejects.toThrow(
        'AppScope ghost not found'
      );
    });
  });

  describe('permission creation', () => {
    it('defaults the target to the resolved scope id', async () => {
      okScope();
      on(PermissionCommands.Create, () => ({ id: 'perm-1' }));

      await service.processNow({
        scopeName: 'social',
        permissions: [{ name: 'post.read', resource: 'post', action: 'read' }],
      });

      expect(sent(PermissionCommands.Create)[0]).toEqual({
        name: 'post.read',
        description: '',
        resource: 'post',
        action: 'read',
        targetId: 'scope-1',
      });
    });

    it('keeps an explicit target id', async () => {
      okScope();
      on(PermissionCommands.Create, () => ({ id: 'perm-1' }));

      await service.processNow({
        scopeName: 'social',
        permissions: [
          {
            name: 'post.read',
            resource: 'post',
            action: 'read',
            targetId: 'target-9',
          },
        ],
      });

      expect(sent(PermissionCommands.Create)[0]).toMatchObject({
        targetId: 'target-9',
      });
    });

    it('carries on when one permission fails to create', async () => {
      okScope();
      on(PermissionCommands.Create, (payload) =>
        payload['name'] === 'bad' ? new Error('duplicate') : { id: 'perm-good' }
      );

      await expect(
        service.processNow({
          scopeName: 'social',
          permissions: [
            { name: 'bad', resource: 'r', action: 'a' },
            { name: 'good', resource: 'r', action: 'a' },
          ],
        })
      ).resolves.toBeUndefined();

      expect(sent(PermissionCommands.Create)).toHaveLength(2);
    });
  });

  describe('role creation and the lookup fallback', () => {
    it('attaches permissions by id when the permission was created', async () => {
      okScope();
      on(PermissionCommands.Create, () => ({ id: 'perm-1' }));
      on(RoleCommands.Create, () => ({ id: 'role-1' }));

      await service.processNow({
        scopeName: 'social',
        permissions: [{ name: 'post.read', resource: 'post', action: 'read' }],
        roles: [{ name: 'Reader', permissions: ['post.read'] }],
      });

      expect(sent(RoleCommands.AddPermission)[0]).toEqual({
        roleId: 'role-1',
        permissionId: 'perm-1',
      });
    });

    it('attaches by name when the permission id is unknown', async () => {
      okScope();
      on(RoleCommands.Create, () => ({ id: 'role-1' }));

      await service.processNow({
        scopeName: 'social',
        roles: [{ name: 'Reader', permissions: ['never.created'] }],
      });

      expect(sent(RoleCommands.AddPermission)[0]).toEqual({
        roleId: 'role-1',
        permissionName: 'never.created',
      });
    });

    it('falls back to the app scope lookup when creation fails', async () => {
      okScope();
      on(RoleCommands.Create, () => new Error('exists'));
      on(RoleCommands.GetByName, (payload) =>
        payload['appScope'] === 'social' ? { id: 'role-existing' } : null
      );

      await service.processNow({
        scopeName: 'social',
        roles: [{ name: 'Reader', permissions: ['p'] }],
      });

      expect(sent(RoleCommands.AddPermission)[0]).toMatchObject({
        roleId: 'role-existing',
      });
    });

    it('falls back to the global scope, then to no scope at all', async () => {
      okScope();
      on(RoleCommands.Create, () => new Error('exists'));
      on(RoleCommands.GetByName, (payload) =>
        // Only the third, scopeless attempt succeeds.
        payload['appScope'] === undefined ? { id: 'role-legacy' } : null
      );

      await service.processNow({
        scopeName: 'social',
        roles: [{ name: 'Reader', permissions: ['p'] }],
      });

      const lookups = sent(RoleCommands.GetByName);
      expect(lookups).toEqual([
        { name: 'Reader', appScope: 'social' },
        { name: 'Reader', appScope: 'global' },
        { name: 'Reader' },
      ]);
      expect(sent(RoleCommands.AddPermission)[0]).toMatchObject({
        roleId: 'role-legacy',
      });
    });

    it('does not retry the global scope when already in it', async () => {
      okScope();
      on(RoleCommands.Create, () => new Error('exists'));
      on(RoleCommands.GetByName, () => null);

      await service.processNow({
        scopeName: 'global',
        roles: [{ name: 'Reader' }],
      });

      expect(sent(RoleCommands.GetByName)).toEqual([
        { name: 'Reader', appScope: 'global' },
        { name: 'Reader' },
      ]);
    });

    it('skips a role it can neither create nor find', async () => {
      okScope();
      on(RoleCommands.Create, () => new Error('exists'));
      on(RoleCommands.GetByName, () => null);

      await service.processNow({
        scopeName: 'social',
        roles: [{ name: 'Ghost', permissions: ['p'] }],
      });

      expect(sent(RoleCommands.AddPermission)).toHaveLength(0);
    });

    it('carries on when attaching a permission fails', async () => {
      okScope();
      on(RoleCommands.Create, () => ({ id: 'role-1' }));
      on(RoleCommands.AddPermission, () => new Error('nope'));

      await expect(
        service.processNow({
          scopeName: 'social',
          roles: [{ name: 'Reader', permissions: ['a', 'b'] }],
        })
      ).resolves.toBeUndefined();

      expect(sent(RoleCommands.AddPermission)).toHaveLength(2);
    });
  });

  describe('assignments', () => {
    it('reuses a role created in the same run rather than looking it up', async () => {
      okScope();
      on(RoleCommands.Create, () => ({ id: 'role-1' }));

      await service.processNow({
        scopeName: 'social',
        roles: [{ name: 'Reader' }],
        assignments: [{ roleName: 'Reader', profileId: 'profile-1' }],
      });

      expect(sent(RoleCommands.GetByName)).toHaveLength(0);
      expect(sent(RoleCommands.Assign)[0]).toEqual({
        roleId: 'role-1',
        appScopeId: 'scope-1',
        profileId: 'profile-1',
      });
    });

    it('assigns to a user id when that is what the assignment carries', async () => {
      okScope();
      on(RoleCommands.GetByName, () => ({ id: 'role-1' }));

      await service.processNow({
        scopeName: 'social',
        assignments: [{ roleName: 'Reader', userId: 'user-1' }],
      });

      expect(sent(RoleCommands.Assign)[0]).toEqual({
        roleId: 'role-1',
        appScopeId: 'scope-1',
        userId: 'user-1',
      });
    });

    it('walks the same three-step lookup for an unknown role', async () => {
      okScope();
      on(RoleCommands.GetByName, (payload) =>
        payload['appScope'] === 'global' ? { id: 'role-global' } : null
      );

      await service.processNow({
        scopeName: 'social',
        assignments: [{ roleName: 'Reader', profileId: 'profile-1' }],
      });

      expect(sent(RoleCommands.Assign)[0]).toMatchObject({
        roleId: 'role-global',
      });
    });

    it('skips an assignment whose role cannot be resolved', async () => {
      okScope();
      on(RoleCommands.GetByName, () => null);

      await service.processNow({
        scopeName: 'social',
        assignments: [{ roleName: 'Ghost', profileId: 'profile-1' }],
      });

      expect(sent(RoleCommands.Assign)).toHaveLength(0);
    });

    it('carries on to the next assignment when one fails', async () => {
      okScope();
      on(RoleCommands.GetByName, () => ({ id: 'role-1' }));
      on(RoleCommands.Assign, () => new Error('conflict'));

      await expect(
        service.processNow({
          scopeName: 'social',
          assignments: [
            { roleName: 'A', profileId: 'p1' },
            { roleName: 'B', profileId: 'p1' },
          ],
        })
      ).resolves.toBeUndefined();

      expect(sent(RoleCommands.Assign)).toHaveLength(2);
    });
  });

  describe('cross-scope mapping', () => {
    // The spec beside this one covers the happy path for the
    // client-interface -> social mapping; these drive its failure branches.
    it('skips a mapping whose target scope does not exist', async () => {
      on(AppScopeCommands.GetByName, (payload) =>
        payload['name'] === 'client-interface' ? { id: 'scope-client' } : null
      );
      on(RoleCommands.GetByName, () => ({ id: 'role-1' }));

      await service.processNow({
        scopeName: 'client-interface',
        assignments: [{ roleName: 'community_owner', profileId: 'profile-1' }],
      });

      // Only the original assignment lands; the social mirror is skipped.
      expect(sent(RoleCommands.Assign)).toHaveLength(1);
    });

    it('carries on when the mirrored assignment itself fails', async () => {
      on(AppScopeCommands.GetByName, (payload) => ({
        id: `scope-${payload['name']}`,
      }));
      on(RoleCommands.GetByName, () => ({ id: 'role-1' }));
      on(RoleCommands.Assign, (payload) =>
        payload['appScopeId'] === 'scope-social'
          ? new Error('duplicate assignment')
          : { ok: true }
      );

      await expect(
        service.processNow({
          scopeName: 'client-interface',
          assignments: [
            { roleName: 'community_owner', profileId: 'profile-1' },
          ],
        })
      ).resolves.toBeUndefined();
    });

    it('reuses a looked-up scope rather than fetching it twice', async () => {
      on(AppScopeCommands.GetByName, (payload) => ({
        id: `scope-${payload['name']}`,
      }));
      on(RoleCommands.GetByName, () => ({ id: 'role-1' }));

      await service.processNow({
        scopeName: 'client-interface',
        assignments: [
          { roleName: 'community_owner', profileId: 'profile-1' },
          { roleName: 'community_owner', profileId: 'profile-2' },
        ],
      });

      // Two assignments map into social, but the scope is cached after the
      // first lookup.
      const socialLookups = sent(AppScopeCommands.GetByName).filter(
        (p) => p['name'] === 'social'
      );
      expect(socialLookups).toHaveLength(1);
    });

    it('does nothing extra for a scope with no cross-scope policy', async () => {
      okScope();
      on(RoleCommands.GetByName, () => ({ id: 'role-1' }));

      await service.processNow({
        scopeName: 'social',
        assignments: [{ roleName: 'Reader', profileId: 'profile-1' }],
      });

      expect(sent(RoleCommands.Assign)).toHaveLength(1);
    });
  });

  describe('queue', () => {
    it('drains everything enqueued', async () => {
      okScope();
      on(RoleCommands.Create, () => ({ id: 'role-1' }));

      service.enqueue({ scopeName: 'social', roles: [{ name: 'A' }] });
      service.enqueue({ scopeName: 'social', roles: [{ name: 'B' }] });

      // The worker starts on setImmediate; let it run to completion.
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      expect(sent(RoleCommands.Create).map((p) => p['name'])).toEqual([
        'A',
        'B',
      ]);
    });

    it('keeps draining after an item throws', async () => {
      on(AppScopeCommands.GetByName, (payload) =>
        payload['name'] === 'ghost' ? null : { id: 'scope-1' }
      );
      on(AppScopeCommands.Create, () => null);
      on(RoleCommands.Create, () => ({ id: 'role-1' }));

      // The first item cannot resolve its scope and throws inside the worker.
      service.enqueue({ scopeName: 'ghost' });
      service.enqueue({ scopeName: 'social', roles: [{ name: 'B' }] });

      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      expect(sent(RoleCommands.Create).map((p) => p['name'])).toEqual(['B']);
    });
  });
});
