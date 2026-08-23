import { of } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { LearningCommands, RoleCommands } from '@optimistic-tanuki/constants';
import { OfferingOwnership } from '@optimistic-tanuki/learning-domain';
import { OfferingAuthorizationService } from './offering-authorization.service';

describe('OfferingAuthorizationService', () => {
  let permissionsClient: jest.Mocked<ClientProxy>;
  let learningService: jest.Mocked<ClientProxy>;
  let service: OfferingAuthorizationService;

  function ownership(
    overrides: Partial<OfferingOwnership> = {}
  ): OfferingOwnership {
    return {
      offeringId: 'offering-1',
      ownerProfileId: 'owner-profile',
      coEditorProfileIds: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  function rolesResponse(names: string[]) {
    return of(names.map((name) => ({ role: { name } })));
  }

  beforeEach(() => {
    permissionsClient = {
      send: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;
    learningService = {
      send: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;
    service = new OfferingAuthorizationService(
      permissionsClient,
      learningService
    );
  });

  it('refuses a plain learner the right to create an offering', async () => {
    permissionsClient.send.mockReturnValue(rolesResponse(['learning_learner']));

    const allowed = await service.authorize('learner-1', undefined, 'create');

    expect(allowed).toBe(false);
  });

  it('lets a course designer create an offering', async () => {
    permissionsClient.send.mockReturnValue(
      rolesResponse(['learning_course_designer'])
    );

    const allowed = await service.authorize('designer-1', undefined, 'create');

    expect(allowed).toBe(true);
  });

  it("refuses a designer who does not own the offering from updating or deleting someone else's", async () => {
    permissionsClient.send.mockReturnValue(
      rolesResponse(['learning_course_designer'])
    );
    learningService.send.mockReturnValue(of(ownership()));

    expect(
      await service.authorize('stranger', undefined, 'update', 'offering-1')
    ).toBe(false);
    expect(
      await service.authorize('stranger', undefined, 'delete', 'offering-1')
    ).toBe(false);
  });

  it('lets the owner update and delete their own offering', async () => {
    permissionsClient.send.mockReturnValue(
      rolesResponse(['learning_course_designer'])
    );
    learningService.send.mockReturnValue(
      of(ownership({ ownerProfileId: 'owner-profile' }))
    );

    expect(
      await service.authorize(
        'owner-profile',
        undefined,
        'update',
        'offering-1'
      )
    ).toBe(true);
    expect(
      await service.authorize(
        'owner-profile',
        undefined,
        'delete',
        'offering-1'
      )
    ).toBe(true);
  });

  it('lets a co-editor update but never delete or reassign ownership', async () => {
    permissionsClient.send.mockReturnValue(
      rolesResponse(['learning_course_editor'])
    );
    learningService.send.mockReturnValue(
      of(ownership({ coEditorProfileIds: ['editor-1'] }))
    );

    expect(
      await service.authorize('editor-1', undefined, 'update', 'offering-1')
    ).toBe(true);
    expect(
      await service.authorize('editor-1', undefined, 'delete', 'offering-1')
    ).toBe(false);
    expect(
      await service.authorize(
        'editor-1',
        undefined,
        'manageCoEditors',
        'offering-1'
      )
    ).toBe(false);
  });

  it('lets learning_admin act on any offering, checked via the learning app scope', async () => {
    permissionsClient.send.mockImplementation((pattern) => {
      const cmd = (pattern as { cmd: string }).cmd;
      if (cmd === RoleCommands.GetUserRoles) {
        return rolesResponse(['learning_admin']);
      }
      return of([]);
    });
    learningService.send.mockReturnValue(of(ownership()));

    expect(
      await service.authorize('admin-1', undefined, 'delete', 'offering-1')
    ).toBe(true);
  });

  // Owner/global_admin are assigned in the platform's global app scope
  // against the caller's own (non-learning) profile id from the token, not
  // their learning profile. Both ids have to be checked.
  it('lets a platform owner act on any offering via their global-scope role', async () => {
    permissionsClient.send.mockImplementation((pattern, payload) => {
      const cmd = (pattern as { cmd: string }).cmd;
      const scope = (payload as { appScope: string }).appScope;
      if (cmd === RoleCommands.GetUserRoles && scope === 'global') {
        return rolesResponse(['owner']);
      }
      return rolesResponse([]);
    });
    learningService.send.mockReturnValue(of(ownership()));

    const allowed = await service.authorize(
      'learning-profile-1',
      'global-profile-1',
      'delete',
      'offering-1'
    );

    expect(allowed).toBe(true);
    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: RoleCommands.GetUserRoles },
      { profileId: 'global-profile-1', appScope: 'global' }
    );
  });

  it('fails closed rather than open when the permissions service is unreachable', async () => {
    permissionsClient.send.mockImplementation(() => {
      throw new Error('permissions service unavailable');
    });
    learningService.send.mockReturnValue(of(ownership()));

    const allowed = await service.authorize(
      'someone',
      undefined,
      'update',
      'offering-1'
    );

    expect(allowed).toBe(false);
  });

  it('asks the learning service for ownership using the offering id', async () => {
    permissionsClient.send.mockReturnValue(rolesResponse(['learning_admin']));
    learningService.send.mockReturnValue(of(ownership()));

    await service.authorize('admin-1', undefined, 'update', 'offering-9');

    // learning_admin short-circuits before ownership would matter for the
    // decision, but the fetch still happens because it runs in parallel;
    // this asserts the shape of the call the non-admin paths depend on.
    expect(learningService.send).toHaveBeenCalledWith(
      { cmd: LearningCommands.GetOfferingOwnership },
      { offeringId: 'offering-9' }
    );
  });
});
