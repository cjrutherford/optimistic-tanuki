import { of, throwError } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { LearningCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { LESSON_NOT_FOUND } from '@optimistic-tanuki/learning-domain';
import { LearningController } from './learning.controller';
import { AuthGuard } from '../../auth/auth.guard';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';
import { LearningProfileResolver } from './learning-profile.resolver';
import { OfferingAuthorizationService } from './offering-authorization.service';

describe('LearningController', () => {
  let client: jest.Mocked<ClientProxy>;
  let profileClient: jest.Mocked<ClientProxy>;
  let profiles: jest.Mocked<LearningProfileResolver>;
  let offeringAuthorization: jest.Mocked<OfferingAuthorizationService>;
  let controller: LearningController;

  beforeEach(() => {
    client = {
      send: jest.fn().mockReturnValue(of([])),
      connect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientProxy>;
    profileClient = {
      send: jest.fn().mockReturnValue(of(null)),
      connect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientProxy>;

    profiles = {
      resolveProfileId: jest.fn().mockResolvedValue('profile-1'),
      optInAsAuthor: jest.fn().mockResolvedValue(undefined),
      isCourseDesigner: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<LearningProfileResolver>;

    offeringAuthorization = {
      authorize: jest.fn().mockResolvedValue(true),
      seesEveryDraft: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<OfferingAuthorizationService>;

    controller = new LearningController(
      client,
      profileClient,
      profiles,
      offeringAuthorization
    );
  });

  describe('me/progress', () => {
    it('reads the signed-in user from the verified token, not the path', async () => {
      client.send.mockReturnValue(of([{ lessonId: 'b-01', points: 10 }]));

      const progress = await controller.getMyProgress({
        user: { userId: 'user-1' },
      });

      expect(profiles.resolveProfileId).toHaveBeenCalledWith('user-1');
      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.GetProgress },
        { profileId: 'profile-1' }
      );
      expect(progress).toEqual([{ lessonId: 'b-01', points: 10 }]);
    });

    // Reading a lesson is open to everyone, so an anonymous visitor gets an
    // empty list and the page still renders. Only saving needs a session.
    it('returns nothing for an anonymous visitor without calling the service', async () => {
      expect(await controller.getMyProgress({})).toEqual([]);
      expect(client.send).not.toHaveBeenCalled();
      expect(profiles.resolveProfileId).not.toHaveBeenCalled();
    });

    it('returns nothing when the guard produced a user with no id', async () => {
      expect(await controller.getMyProgress({ user: {} })).toEqual([]);
      expect(client.send).not.toHaveBeenCalled();
    });
  });

  describe('guards', () => {
    it('runs AuthGuard on every route that mutates or executes', () => {
      for (const handler of [
        LearningController.prototype.submitAttempt,
        LearningController.prototype.recordEvaluation,
        LearningController.prototype.runCode,
        LearningController.prototype.submitExercise,
        LearningController.prototype.saveMyProgress,
        LearningController.prototype.getMyProgress,
        LearningController.prototype.getDashboard,
        LearningController.prototype.enrol,
        LearningController.prototype.withdraw,
        LearningController.prototype.getMyEnrolments,
        LearningController.prototype.optInAsAuthor,
        LearningController.prototype.getAuthorStatus,
        LearningController.prototype.createOffering,
        LearningController.prototype.updateOffering,
        LearningController.prototype.deleteOffering,
        LearningController.prototype.setCoEditors,
        LearningController.prototype.setOfferingStatus,
      ]) {
        expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual(
          expect.arrayContaining([AuthGuard])
        );
      }
    });

    it('keeps read routes open to anonymous callers with @Public', () => {
      for (const handler of [
        LearningController.prototype.getDashboard,
        LearningController.prototype.getMyProgress,
        LearningController.prototype.listPrograms,
      ]) {
        expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
      }
    });

    it('does not mark the mutating or executing routes as @Public', () => {
      for (const handler of [
        LearningController.prototype.submitAttempt,
        LearningController.prototype.recordEvaluation,
        LearningController.prototype.runCode,
        LearningController.prototype.submitExercise,
        LearningController.prototype.saveMyProgress,
        LearningController.prototype.enrol,
        LearningController.prototype.withdraw,
        LearningController.prototype.getMyEnrolments,
        LearningController.prototype.optInAsAuthor,
        LearningController.prototype.createOffering,
        LearningController.prototype.updateOffering,
        LearningController.prototype.deleteOffering,
        LearningController.prototype.setCoEditors,
        LearningController.prototype.setOfferingStatus,
      ]) {
        expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).not.toBe(true);
      }
    });

    // Regression net: a mutating handler added later without @UseGuards(AuthGuard)
    // fails this test instead of shipping as a silent authorization hole.
    it('guards every POST, PUT, PATCH and DELETE handler on the controller', () => {
      const mutatingMethods = new Set([
        RequestMethod.POST,
        RequestMethod.PUT,
        RequestMethod.PATCH,
        RequestMethod.DELETE,
      ]);

      const handlers = Object.getOwnPropertyNames(LearningController.prototype)
        .filter((name) => name !== 'constructor')
        .map(
          (name) =>
            LearningController.prototype[
              name as keyof LearningController
            ] as unknown
        )
        .filter(
          (value): value is (...args: unknown[]) => unknown =>
            typeof value === 'function'
        )
        .filter(
          (handler) => Reflect.getMetadata(PATH_METADATA, handler) !== undefined
        );

      expect(handlers.length).toBeGreaterThan(0);

      for (const handler of handlers) {
        const method = Reflect.getMetadata(METHOD_METADATA, handler);
        if (!mutatingMethods.has(method)) continue;

        const path = Reflect.getMetadata(PATH_METADATA, handler);
        const guards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
        expect({ path, guards }).toEqual({
          path,
          guards: expect.arrayContaining([AuthGuard]),
        });
      }
    });
  });

  describe('attempts', () => {
    it('takes the acting user from the token and ignores a userId in the body', async () => {
      client.send.mockReturnValue(of({ id: 'attempt-1' }));

      await controller.submitAttempt(
        {
          userId: 'attacker-supplied-id',
          offeringId: 'go-foundations',
          activityId: 'go-b-01',
          activityType: 'exercise',
          submission: { code: 'package main' },
        },
        { user: { userId: 'user-1' } }
      );

      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.SubmitAttempt },
        expect.objectContaining({ userId: 'user-1' })
      );
      const [, payload] = client.send.mock.calls[0] as [
        unknown,
        { userId: string }
      ];
      expect(payload.userId).toBe('user-1');
      expect(payload.userId).not.toBe('attacker-supplied-id');
    });
  });

  describe('evaluations', () => {
    it('forwards the acting user as the grader identity', async () => {
      client.send.mockReturnValue(of({ id: 'eval-1' }));

      await controller.recordEvaluation(
        {
          attemptId: 'attempt-1',
          mode: 'auto',
          grader: 'runner',
          score: 8,
          maxScore: 10,
          feedback: 'Looks right',
        },
        { user: { userId: 'grader-1' } }
      );

      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.RecordEvaluation },
        expect.objectContaining({ recordedByUserId: 'grader-1' })
      );
    });
  });

  describe('exercise submit', () => {
    it('takes the user id from the token and the code from the body', async () => {
      client.send.mockReturnValue(of({ passed: true, awardedPoints: 10 }));

      const result = await controller.submitExercise(
        'go-b-01',
        { code: 'package main' },
        { user: { userId: 'user-1' } }
      );

      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.SubmitExercise },
        {
          userId: 'user-1',
          profileId: 'profile-1',
          activityId: 'go-b-01',
          code: 'package main',
        }
      );
      expect(result).toEqual({ passed: true, awardedPoints: 10 });
    });
  });

  describe('enrolments', () => {
    it('enrols using the resolved profile, not a caller-supplied id', async () => {
      client.send.mockReturnValue(of({ id: 'enrolment-1', status: 'active' }));

      await controller.enrol(
        { offeringId: 'go-foundations-100-core' },
        { user: { userId: 'user-1' } }
      );

      expect(profiles.resolveProfileId).toHaveBeenCalledWith('user-1');
      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.Enrol },
        { profileId: 'profile-1', offeringId: 'go-foundations-100-core' }
      );
    });

    it('withdraws using the resolved profile', async () => {
      client.send.mockReturnValue(
        of({ id: 'enrolment-1', status: 'withdrawn' })
      );

      await controller.withdraw('go-foundations-100-core', {
        user: { userId: 'user-1' },
      });

      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.Withdraw },
        { profileId: 'profile-1', offeringId: 'go-foundations-100-core' }
      );
    });

    it('lists enrolments for the resolved profile', async () => {
      client.send.mockReturnValue(of([{ id: 'enrolment-1' }]));

      const result = await controller.getMyEnrolments({
        user: { userId: 'user-1' },
      });

      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.ListMyEnrolments },
        { profileId: 'profile-1' }
      );
      expect(result).toEqual([{ id: 'enrolment-1' }]);
    });
  });

  describe('opting in to author', () => {
    it('grants the designer role through the resolved profile and reports opted-in', async () => {
      const result = await controller.optInAsAuthor({
        user: { userId: 'user-1' },
      });

      expect(profiles.resolveProfileId).toHaveBeenCalledWith('user-1');
      expect(profiles.optInAsAuthor).toHaveBeenCalledWith('profile-1');
      expect(result).toEqual({ isCourseDesigner: true });
    });

    it('is safe to call twice, since the resolver treats re-granting as a no-op', async () => {
      await controller.optInAsAuthor({ user: { userId: 'user-1' } });
      await expect(
        controller.optInAsAuthor({ user: { userId: 'user-1' } })
      ).resolves.toEqual({ isCourseDesigner: true });
      expect(profiles.optInAsAuthor).toHaveBeenCalledTimes(2);
    });

    it('reports the caller status for a UI to branch on', async () => {
      profiles.isCourseDesigner.mockResolvedValue(true);

      const result = await controller.getAuthorStatus({
        user: { userId: 'user-1' },
      });

      expect(result).toEqual({ isCourseDesigner: true });
    });
  });

  describe('offering authoring routes', () => {
    it('creates an offering once the authorization service allows it', async () => {
      client.send.mockReturnValue(
        of({
          track: { id: 'offering-1' },
          ownership: { ownerProfileId: 'profile-1' },
        })
      );

      await controller.createOffering(
        { displayName: 'Intro to Watercolor', subjectId: 'art' },
        { user: { userId: 'user-1', profileId: 'global-profile-1' } }
      );

      expect(offeringAuthorization.authorize).toHaveBeenCalledWith(
        'profile-1',
        'global-profile-1',
        'create'
      );
      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.CreateOffering },
        {
          profileId: 'profile-1',
          input: { displayName: 'Intro to Watercolor', subjectId: 'art' },
        }
      );
    });

    it('refuses to create an offering when the authorization service denies it', async () => {
      offeringAuthorization.authorize.mockResolvedValue(false);

      await expect(
        controller.createOffering(
          { displayName: 'Intro to Watercolor', subjectId: 'art' },
          { user: { userId: 'user-1' } }
        )
      ).rejects.toThrow();
      expect(client.send).not.toHaveBeenCalled();
    });

    it('checks ownership-scoped authorization before updating an offering', async () => {
      client.send.mockReturnValue(of({ id: 'offering-1' }));

      await controller.updateOffering(
        'offering-1',
        { displayName: 'New title' },
        { user: { userId: 'user-1' } }
      );

      expect(offeringAuthorization.authorize).toHaveBeenCalledWith(
        'profile-1',
        undefined,
        'update',
        'offering-1'
      );
      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.UpdateOffering },
        { offeringId: 'offering-1', patch: { displayName: 'New title' } }
      );
    });

    it('refuses to update an offering when the authorization service denies it', async () => {
      offeringAuthorization.authorize.mockResolvedValue(false);

      await expect(
        controller.updateOffering(
          'offering-1',
          { displayName: 'New title' },
          { user: { userId: 'user-1' } }
        )
      ).rejects.toThrow();
      expect(client.send).not.toHaveBeenCalled();
    });

    it('deletes an offering only once authorization allows it', async () => {
      client.send.mockReturnValue(of({ ok: true }));

      await controller.deleteOffering('offering-1', {
        user: { userId: 'user-1' },
      });

      expect(offeringAuthorization.authorize).toHaveBeenCalledWith(
        'profile-1',
        undefined,
        'delete',
        'offering-1'
      );
      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.DeleteOffering },
        { offeringId: 'offering-1' }
      );
    });

    it('refuses to delete an offering when the authorization service denies it', async () => {
      offeringAuthorization.authorize.mockResolvedValue(false);

      await expect(
        controller.deleteOffering('offering-1', { user: { userId: 'user-1' } })
      ).rejects.toThrow();
      expect(client.send).not.toHaveBeenCalled();
    });

    it('gates co-editor management the same way as delete', async () => {
      client.send.mockReturnValue(of({ ok: true }));

      await controller.setCoEditors(
        'offering-1',
        { coEditorProfileIds: ['profile-2'] },
        { user: { userId: 'user-1' } }
      );

      expect(offeringAuthorization.authorize).toHaveBeenCalledWith(
        'profile-1',
        undefined,
        'manageCoEditors',
        'offering-1'
      );
      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.SetCoEditors },
        { offeringId: 'offering-1', coEditorProfileIds: ['profile-2'] }
      );
    });
  });
});

describe('LearningController catalog and publication', () => {
  let client: jest.Mocked<ClientProxy>;
  let profileClient: jest.Mocked<ClientProxy>;
  let profiles: jest.Mocked<LearningProfileResolver>;
  let offeringAuthorization: jest.Mocked<OfferingAuthorizationService>;
  let controller: LearningController;

  beforeEach(() => {
    client = {
      send: jest.fn().mockReturnValue(of([])),
      connect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientProxy>;
    profileClient = {
      send: jest.fn().mockReturnValue(of(null)),
      connect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientProxy>;
    profiles = {
      resolveProfileId: jest.fn().mockResolvedValue('profile-1'),
    } as unknown as jest.Mocked<LearningProfileResolver>;
    offeringAuthorization = {
      authorize: jest.fn().mockResolvedValue(true),
      seesEveryDraft: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<OfferingAuthorizationService>;
    controller = new LearningController(
      client,
      profileClient,
      profiles,
      offeringAuthorization
    );
  });

  describe('the catalog knows who is asking', () => {
    it('asks for the anonymous catalog when nobody is signed in', async () => {
      await controller.listPrograms({});

      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.ListCatalog },
        {}
      );
      expect(profiles.resolveProfileId).not.toHaveBeenCalled();
    });

    it('passes the caller profile so an author sees their own drafts', async () => {
      await controller.listPrograms({ user: { userId: 'user-1' } });

      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.ListCatalog },
        { profileId: 'profile-1', seesEveryDraft: false }
      );
    });

    it('marks a platform owner as seeing every draft', async () => {
      offeringAuthorization.seesEveryDraft.mockResolvedValue(true);

      await controller.listPrograms({
        user: { userId: 'user-1', profileId: 'token-profile' },
      });

      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.ListCatalog },
        { profileId: 'profile-1', seesEveryDraft: true }
      );
    });
  });

  /**
   * Every course said its author was not recorded, because this read `name`
   * from a profile whose field is `profileName`. Nothing failed: the lookup
   * simply returned undefined and the page fell back to saying nothing.
   */
  describe('who wrote a course', () => {
    beforeEach(() => {
      client.send.mockReturnValue(of({ ownerProfileId: 'owner-1' }));
    });

    it('names the author from the profile field that actually exists', async () => {
      profileClient.send.mockReturnValue(
        of({ id: 'owner-1', profileName: 'Ada Lovelace' })
      );

      const detail = (await controller.getOffering('go-100', {})) as {
        author: { displayName: string } | null;
      };

      expect(detail.author).toEqual({
        profileId: 'owner-1',
        displayName: 'Ada Lovelace',
      });
    });

    it('says nothing rather than guessing when the profile has no name', async () => {
      profileClient.send.mockReturnValue(
        of({ id: 'owner-1', profileName: '' })
      );

      const detail = (await controller.getOffering('go-100', {})) as {
        author: unknown;
      };

      expect(detail.author).toBeNull();
    });

    it('says nothing for a course nobody owns', async () => {
      client.send.mockReturnValue(of({}));

      const detail = (await controller.getOffering('go-100', {})) as {
        author: unknown;
      };

      expect(detail.author).toBeNull();
      expect(profileClient.send).not.toHaveBeenCalled();
    });

    // One line of text is not worth failing the whole page for.
    it('still renders the course when the profile service is unreachable', async () => {
      profileClient.send.mockReturnValue(
        throwError(() => new Error('connection refused'))
      );

      const detail = (await controller.getOffering('go-100', {})) as {
        author: unknown;
      };

      expect(detail.author).toBeNull();
    });
  });

  describe('reading a lesson', () => {
    it('is open to anonymous callers but still says who is asking', async () => {
      expect(
        Reflect.getMetadata(
          IS_PUBLIC_KEY,
          LearningController.prototype.getLesson
        )
      ).toBe(true);

      await controller.getLesson('art-1', 'art-lesson-1', {});

      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.GetLesson },
        { trackId: 'art-1', lessonId: 'art-lesson-1', viewer: {} }
      );
    });

    it('passes the caller so an author can read their own draft', async () => {
      await controller.getLesson('art-1', 'art-lesson-1', {
        user: { userId: 'user-1', profileId: 'token-profile' },
      });

      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.GetLesson },
        {
          trackId: 'art-1',
          lessonId: 'art-lesson-1',
          viewer: { profileId: 'profile-1', seesEveryDraft: false },
        }
      );
    });
  });

  describe('an unknown lesson', () => {
    // It answered 500, which is now also the answer for a draft somebody is
    // not entitled to read. Both should be 404, and indistinguishable.
    it('is a 404, not a server error', async () => {
      // The shape the TCP client actually produces: the handler's payload
      // arrives under `error`, not as a message on an Error.
      client.send.mockReturnValue(
        throwError(() => ({
          error: {
            code: LESSON_NOT_FOUND,
            trackId: 'go-foundations',
            lessonId: 'nope',
          },
        }))
      );

      await expect(
        controller.getLesson('go-foundations', 'nope', {})
      ).rejects.toMatchObject({ status: 404 });
    });

    it('reports an unknown track the same way', async () => {
      client.send.mockReturnValue(
        throwError(() => ({
          error: {
            code: LESSON_NOT_FOUND,
            trackId: 'nope',
            lessonId: 'lesson',
          },
        }))
      );

      await expect(
        controller.getLesson('nope', 'lesson', {})
      ).rejects.toMatchObject({ status: 404 });
    });

    it('leaves a real failure alone rather than calling it a 404', async () => {
      client.send.mockReturnValue(
        throwError(() => new Error('connection refused'))
      );

      await expect(
        controller.getLesson('go-foundations', 'l', {})
      ).rejects.toThrow(/connection refused/);
    });
  });

  describe('publishing', () => {
    const req = { user: { userId: 'user-1', profileId: 'token-profile' } };

    it('publishes when the caller is allowed to', async () => {
      await controller.setOfferingStatus('o-1', { status: 'published' }, req);

      expect(offeringAuthorization.authorize).toHaveBeenCalledWith(
        'profile-1',
        'token-profile',
        'publish',
        'o-1'
      );
      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.SetOfferingStatus },
        { offeringId: 'o-1', status: 'published' }
      );
    });

    it('refuses a caller who may edit but not publish', async () => {
      offeringAuthorization.authorize.mockResolvedValue(false);

      await expect(
        controller.setOfferingStatus('o-1', { status: 'published' }, req)
      ).rejects.toThrow(/may publish/);
      expect(client.send).not.toHaveBeenCalled();
    });

    // Anything other than draft or published would be stored as-is and then
    // fail to parse on the way back out.
    it('refuses a status that is not one of the two', async () => {
      await expect(
        controller.setOfferingStatus('o-1', { status: 'live' }, req)
      ).rejects.toThrow(/draft or published/);
      expect(client.send).not.toHaveBeenCalled();
    });

    it('refuses a missing status without asking anyone', async () => {
      await expect(
        controller.setOfferingStatus('o-1', { status: undefined }, req)
      ).rejects.toThrow(/draft or published/);
      expect(offeringAuthorization.authorize).not.toHaveBeenCalled();
    });
  });

  describe('saving authored content', () => {
    it('sends modules and activities through to the service', async () => {
      const modules = [{ id: 'm', title: 'Pigments', lessons: [] }];

      await controller.updateOffering(
        'o-1',
        { modules, activities: [] },
        { user: { userId: 'user-1', profileId: 'token-profile' } }
      );

      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.UpdateOffering },
        { offeringId: 'o-1', patch: { modules, activities: [] } }
      );
    });

    it('refuses content from a caller who does not own the course', async () => {
      offeringAuthorization.authorize.mockResolvedValue(false);

      await expect(
        controller.updateOffering(
          'o-1',
          { modules: [] },
          { user: { userId: 'user-1' } }
        )
      ).rejects.toThrow(/own or co-edit/);
      expect(client.send).not.toHaveBeenCalled();
    });
  });
});

/**
 * Wiring, not behaviour.
 *
 * Every other test in this file builds the controller with `new` and a row of
 * positional arguments, which cannot notice a collaborator Nest is unable to
 * resolve. That exact mistake once passed 836 tests and then refused to start
 * the service, so the controller is also resolved through the injector here.
 */
describe('LearningController wiring', () => {
  it('resolves through the injector with every collaborator', async () => {
    const proxy = {
      send: jest.fn().mockReturnValue(of([])),
      connect: jest.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [LearningController],
      providers: [
        { provide: ServiceTokens.LEARNING_SERVICE, useValue: proxy },
        { provide: ServiceTokens.PROFILE_SERVICE, useValue: proxy },
        { provide: LearningProfileResolver, useValue: {} },
        { provide: OfferingAuthorizationService, useValue: {} },
        // AuthGuard is attached to most of these routes, so the injector
        // builds it too. Its own collaborators have to resolve for the
        // controller to resolve, which is worth knowing here rather than at
        // container start.
        { provide: ServiceTokens.AUTHENTICATION_SERVICE, useValue: proxy },
        { provide: ServiceTokens.PERMISSIONS_SERVICE, useValue: proxy },
        { provide: JwtService, useValue: {} },
      ],
    }).compile();

    expect(moduleRef.get(LearningController)).toBeInstanceOf(
      LearningController
    );
  });
});
