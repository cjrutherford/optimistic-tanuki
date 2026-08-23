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
      .mockReturnValueOnce(of(null))
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
});
