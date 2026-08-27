import { of, throwError } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { ProfileCommands, RoleCommands } from '@optimistic-tanuki/constants';
import { LearningProfileResolver } from './learning-profile.resolver';

describe('LearningProfileResolver', () => {
  let profileClient: jest.Mocked<ClientProxy>;
  let permissionsClient: jest.Mocked<ClientProxy>;
  let resolver: LearningProfileResolver;

  beforeEach(() => {
    profileClient = {
      send: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;
    permissionsClient = {
      send: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;

    resolver = new LearningProfileResolver(profileClient, permissionsClient);
  });

  it('returns the existing learning profile without creating one', async () => {
    profileClient.send.mockReturnValue(of({ id: 'profile-1' }));

    const profileId = await resolver.resolveProfileId('user-1');

    expect(profileId).toBe('profile-1');
    expect(profileClient.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.Get },
      { userId: 'user-1', appScope: 'learning' }
    );
    expect(profileClient.send).toHaveBeenCalledTimes(1);
    expect(permissionsClient.send).not.toHaveBeenCalled();
  });

  it('creates a learning profile and grants learning_learner on first visit', async () => {
    profileClient.send
      // The learning-scope lookup, then the global-scope one that supplies a
      // name for the new profile, then the create.
      .mockReturnValueOnce(of(null))
      .mockReturnValueOnce(of({ id: 'global-1', profileName: 'Ada' }))
      .mockReturnValueOnce(of({ id: 'profile-new' }));
    permissionsClient.send
      .mockReturnValueOnce(
        of({ id: 'role-learner', appScope: { id: 'scope-learning' } })
      )
      .mockReturnValueOnce(of({ id: 'assignment-1' }));

    const profileId = await resolver.resolveProfileId('user-2');

    expect(profileId).toBe('profile-new');
    expect(profileClient.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.Create },
      expect.objectContaining({ userId: 'user-2', appScope: 'learning' })
    );
    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: RoleCommands.GetByName },
      { name: 'learning_learner', appScope: 'learning' }
    );
    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: RoleCommands.Assign },
      {
        roleId: 'role-learner',
        profileId: 'profile-new',
        appScopeId: 'scope-learning',
      }
    );
  });

  // A failed role grant must not block the request. The profile still gets
  // created; the caller just starts without learning_learner until an admin
  // fixes it, mirroring how profile.service.ts treats a failed role copy.
  it('creates the profile even if granting the role fails', async () => {
    profileClient.send
      .mockReturnValueOnce(of(null))
      .mockReturnValueOnce(of(null))
      .mockReturnValueOnce(of({ id: 'profile-new' }));
    permissionsClient.send.mockReturnValueOnce(
      throwError(() => new Error('permissions service unavailable'))
    );

    await expect(resolver.resolveProfileId('user-3')).resolves.toBe(
      'profile-new'
    );
  });

  it('never creates a profile for an anonymous caller', async () => {
    await expect(resolver.resolveProfileId('')).rejects.toThrow();
    expect(profileClient.send).not.toHaveBeenCalled();
  });

  describe('opting in as a course author', () => {
    it('grants learning_course_designer through the same role-lookup path as learning_learner', async () => {
      permissionsClient.send
        .mockReturnValueOnce(
          of({ id: 'role-designer', appScope: { id: 'scope-learning' } })
        )
        .mockReturnValueOnce(of({ id: 'assignment-1' }));

      await resolver.optInAsAuthor('profile-1');

      expect(permissionsClient.send).toHaveBeenCalledWith(
        { cmd: RoleCommands.GetByName },
        { name: 'learning_course_designer', appScope: 'learning' }
      );
      expect(permissionsClient.send).toHaveBeenCalledWith(
        { cmd: RoleCommands.Assign },
        {
          roleId: 'role-designer',
          profileId: 'profile-1',
          appScopeId: 'scope-learning',
        }
      );
    });

    // The permissions service itself treats re-assigning an already-held
    // role as a no-op (roles.service.assignRole returns the existing
    // assignment rather than erroring). This just proves the resolver keeps
    // calling the same idempotent path on a second opt-in instead of guarding
    // client-side and silently doing nothing.
    it('does not throw when opting in a second time', async () => {
      permissionsClient.send.mockReturnValue(
        of({ id: 'role-designer', appScope: { id: 'scope-learning' } })
      );

      await resolver.optInAsAuthor('profile-1');
      await expect(
        resolver.optInAsAuthor('profile-1')
      ).resolves.toBeUndefined();
    });

    it('reports course-designer status from the learning-scoped role list', async () => {
      permissionsClient.send.mockReturnValue(
        of([{ role: { name: 'learning_course_designer' } }])
      );

      await expect(resolver.isCourseDesigner('profile-1')).resolves.toBe(true);
    });

    it('reports false when the role is absent', async () => {
      permissionsClient.send.mockReturnValue(
        of([{ role: { name: 'learning_learner' } }])
      );

      await expect(resolver.isCourseDesigner('profile-1')).resolves.toBe(false);
    });
  });
});

/**
 * A learning profile used to be created with the literal name 'Learner', so
 * every course anyone wrote said "Written by Learner" on its own page. Found
 * by writing a course in the running stack and reading the result.
 */
describe('LearningProfileResolver names a new profile', () => {
  function build(responses: Record<string, unknown>) {
    const profileClient = {
      send: jest.fn(
        (pattern: { cmd: string }, payload: { appScope?: string }) => {
          if (pattern.cmd === ProfileCommands.Create) {
            return of({
              id: 'new-profile',
              userId: 'u1',
              appScope: 'learning',
            });
          }
          return of(responses[payload?.appScope ?? ''] ?? null);
        }
      ),
    } as unknown as ClientProxy;
    const permissionsClient = {
      send: jest.fn().mockReturnValue(of(null)),
    } as unknown as ClientProxy;
    return {
      resolver: new LearningProfileResolver(profileClient, permissionsClient),
      profileClient,
    };
  }

  function createdWith(profileClient: ClientProxy) {
    const send = profileClient.send as unknown as jest.Mock;
    return send.mock.calls.find(
      ([pattern]) => pattern.cmd === ProfileCommands.Create
    )?.[1];
  }

  it('borrows the name the person already goes by', async () => {
    const { resolver, profileClient } = build({
      learning: null,
      global: { id: 'g1', profileName: 'Ada Lovelace' },
    });

    await resolver.resolveProfileId('u1');

    expect(createdWith(profileClient).name).toBe('Ada Lovelace');
  });

  it('falls back to Learner when there is no name to borrow', async () => {
    const { resolver, profileClient } = build({ learning: null, global: null });

    await resolver.resolveProfileId('u1');

    expect(createdWith(profileClient).name).toBe('Learner');
  });

  it('does not use a blank name', async () => {
    const { resolver, profileClient } = build({
      learning: null,
      global: { id: 'g1', profileName: '   ' },
    });

    await resolver.resolveProfileId('u1');

    expect(createdWith(profileClient).name).toBe('Learner');
  });

  it('creates nothing new when a learning profile already exists', async () => {
    const { resolver, profileClient } = build({
      learning: { id: 'existing', userId: 'u1', appScope: 'learning' },
    });

    expect(await resolver.resolveProfileId('u1')).toBe('existing');
    expect(createdWith(profileClient)).toBeUndefined();
  });
});
