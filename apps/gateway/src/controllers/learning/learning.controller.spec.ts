import { of } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { LearningCommands } from '@optimistic-tanuki/constants';
import { LearningController } from './learning.controller';
import { AuthGuard } from '../../auth/auth.guard';
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator';

describe('LearningController', () => {
  let client: jest.Mocked<ClientProxy>;
  let controller: LearningController;

  beforeEach(() => {
    client = {
      send: jest.fn().mockReturnValue(of([])),
      connect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientProxy>;

    controller = new LearningController(client);
  });

  describe('me/progress', () => {
    it('reads the signed-in user from the verified token, not the path', async () => {
      client.send.mockReturnValue(of([{ lessonId: 'b-01', points: 10 }]));

      const progress = await controller.getMyProgress({
        user: { userId: 'user-1' },
      });

      expect(client.send).toHaveBeenCalledWith(
        { cmd: LearningCommands.GetProgress },
        { userId: 'user-1' }
      );
      expect(progress).toEqual([{ lessonId: 'b-01', points: 10 }]);
    });

    // Reading a lesson is open to everyone, so an anonymous visitor gets an
    // empty list and the page still renders. Only saving needs a session.
    it('returns nothing for an anonymous visitor without calling the service', async () => {
      expect(await controller.getMyProgress({})).toEqual([]);
      expect(client.send).not.toHaveBeenCalled();
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
        { userId: 'user-1', activityId: 'go-b-01', code: 'package main' }
      );
      expect(result).toEqual({ passed: true, awardedPoints: 10 });
    });
  });
});
