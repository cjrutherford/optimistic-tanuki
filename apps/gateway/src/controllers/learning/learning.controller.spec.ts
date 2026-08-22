import { of } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { LearningCommands } from '@optimistic-tanuki/constants';
import { LearningController } from './learning.controller';
import { AuthGuard } from '../../auth/auth.guard';

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
    it('runs AuthGuard on the routes that read or write a session', () => {
      for (const handler of [
        LearningController.prototype.getMyProgress,
        LearningController.prototype.saveMyProgress,
        LearningController.prototype.submitExercise,
        LearningController.prototype.getDashboard,
      ]) {
        expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual(
          expect.arrayContaining([AuthGuard])
        );
      }
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
