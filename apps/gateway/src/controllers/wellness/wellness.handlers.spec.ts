import { of, throwError } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { HttpException, HttpStatus } from '@nestjs/common';
import {
  WellnessAiCommands,
  WellnessCommands,
} from '@optimistic-tanuki/constants';
import { WellnessController } from './wellness.controller';

/**
 * The spec beside this one covers the guard metadata and the daily-four/six
 * identity handling. These invoke the remaining handlers: every AI proxy, the
 * update/delete routes, and the uniform 500 each produces when the downstream
 * service fails.
 */
describe('Gateway WellnessController handlers', () => {
  let controller: WellnessController;
  let wellnessClient: { send: jest.Mock; connect: jest.Mock };
  let aiClient: { send: jest.Mock; connect: jest.Mock };

  const lastPattern = (client: { send: jest.Mock }) =>
    client.send.mock.calls.at(-1)?.[0];
  const lastPayload = (client: { send: jest.Mock }) =>
    client.send.mock.calls.at(-1)?.[1];

  const buildController = () => {
    controller = new WellnessController(
      wellnessClient as unknown as ClientProxy,
      aiClient as unknown as ClientProxy
    );

    // Silence the per-instance logger rather than the console.
    (
      controller as unknown as {
        logger: { log: jest.Mock; error: jest.Mock };
      }
    ).logger = { log: jest.fn(), error: jest.fn() } as never;
  };

  beforeEach(() => {
    wellnessClient = {
      send: jest.fn().mockReturnValue(of({})),
      connect: jest.fn().mockResolvedValue(undefined),
    };
    aiClient = {
      send: jest.fn().mockReturnValue(of({})),
      connect: jest.fn().mockResolvedValue(undefined),
    };
    buildController();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('construction', () => {
    it('eagerly connects both clients', () => {
      expect(wellnessClient.connect).toHaveBeenCalled();
      expect(aiClient.connect).toHaveBeenCalled();
    });

    it('logs, but does not throw on, a connection failure', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const failure = new Error('broker down');
      wellnessClient.connect = jest.fn().mockRejectedValue(failure);
      aiClient.connect = jest.fn().mockRejectedValue(failure);

      expect(() => buildController()).not.toThrow();

      // The rejections are handled on a later microtask.
      await Promise.resolve();
      await Promise.resolve();
      expect(consoleError).toHaveBeenCalledWith(failure);
    });
  });

  describe('AI proxies', () => {
    const cases: Array<{
      name: string;
      cmd: string;
      failureMessage: string;
      call: () => Promise<unknown>;
      payload: unknown;
    }> = [
      {
        name: 'generateAiPrompt',
        cmd: WellnessAiCommands.GENERATE_PROMPT,
        failureMessage: 'Failed to generate AI prompt',
        call: () =>
          controller.generateAiPrompt({
            userInput: 'stressed',
            contextType: 'gratitude',
          }),
        payload: { userInput: 'stressed', contextType: 'gratitude' },
      },
      {
        name: 'getWellnessContext',
        cmd: WellnessAiCommands.GET_CONTEXT,
        failureMessage: 'Failed to get wellness context',
        call: () => controller.getWellnessContext({ contextType: 'gratitude' }),
        payload: { contextType: 'gratitude' },
      },
      {
        name: 'getAffirmationSuggestion',
        cmd: WellnessAiCommands.GET_AFFIRMATION,
        failureMessage: 'Failed to get affirmation suggestion',
        call: () =>
          controller.getAffirmationSuggestion({ userGoals: ['sleep'] }),
        payload: { userGoals: ['sleep'] },
      },
      {
        name: 'getMindfulActivitySuggestion',
        cmd: WellnessAiCommands.GET_MINDFUL_ACTIVITY,
        failureMessage: 'Failed to get mindful activity suggestion',
        call: () =>
          controller.getMindfulActivitySuggestion({
            previousActivities: ['walk'],
          }),
        payload: { previousActivities: ['walk'] },
      },
      {
        name: 'analyzeGratitude',
        cmd: WellnessAiCommands.ANALYZE_GRATITUDE,
        failureMessage: 'Failed to analyze gratitude',
        call: () => controller.analyzeGratitude({ gratitudeEntry: 'sunshine' }),
        payload: { gratitudeEntry: 'sunshine' },
      },
      {
        name: 'reflectJudgment',
        cmd: WellnessAiCommands.REFLECT_JUDGMENT,
        failureMessage: 'Failed to generate judgment reflection',
        call: () => controller.reflectJudgment({ judgment: 'too harsh' }),
        payload: { judgment: 'too harsh' },
      },
    ];

    it.each(cases)(
      '$name forwards the body to the AI orchestration service',
      async ({ cmd, call, payload }) => {
        aiClient.send.mockReturnValue(of({ result: 'ok' }));

        await expect(call()).resolves.toEqual({ result: 'ok' });

        expect(lastPattern(aiClient)).toEqual({ cmd });
        expect(lastPayload(aiClient)).toEqual(payload);
        // AI work never touches the wellness data service.
        expect(wellnessClient.send).not.toHaveBeenCalled();
      }
    );

    it.each(cases)(
      '$name converts a downstream failure into a 500',
      async ({ call, failureMessage }) => {
        aiClient.send.mockReturnValue(
          throwError(() => new Error('orchestration down'))
        );

        // The downstream reason is deliberately dropped: the client gets a
        // fixed message and a 500.
        await expect(call()).rejects.toMatchObject({
          message: failureMessage,
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        });
        await expect(call()).rejects.toBeInstanceOf(HttpException);
      }
    );
  });

  describe('daily four writes', () => {
    it('updates an entry by id with the dto nested', async () => {
      wellnessClient.send.mockReturnValue(of({ id: 'df-1' }));

      await expect(
        controller.updateDailyFour('df-1', { gratitude: 'coffee' })
      ).resolves.toEqual({ id: 'df-1' });

      expect(lastPattern(wellnessClient)).toEqual({
        cmd: WellnessCommands.UPDATE_DAILY_FOUR,
      });
      expect(lastPayload(wellnessClient)).toEqual({
        id: 'df-1',
        dto: { gratitude: 'coffee' },
      });
    });

    it('converts an update failure into a 500', async () => {
      wellnessClient.send.mockReturnValue(
        throwError(() => new Error('db down'))
      );

      await expect(
        controller.updateDailyFour('df-1', {})
      ).rejects.toMatchObject({
        message: 'Failed to update DailyFour entry',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('deletes an entry by id', async () => {
      wellnessClient.send.mockReturnValue(of({ deleted: true }));

      await expect(controller.deleteDailyFour('df-1')).resolves.toEqual({
        deleted: true,
      });
      expect(lastPattern(wellnessClient)).toEqual({
        cmd: WellnessCommands.DELETE_DAILY_FOUR,
      });
      expect(lastPayload(wellnessClient)).toEqual({ id: 'df-1' });
    });

    it('converts a delete failure into a 500', async () => {
      wellnessClient.send.mockReturnValue(
        throwError(() => new Error('db down'))
      );

      await expect(controller.deleteDailyFour('df-1')).rejects.toMatchObject({
        message: 'Failed to delete DailyFour entry',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('converts a create failure into a 500', async () => {
      wellnessClient.send.mockReturnValue(
        throwError(() => new Error('db down'))
      );

      await expect(
        controller.createDailyFour(
          {
            affirmation: 'a',
            mindfulActivity: 'b',
            gratitude: 'c',
            plannedPleasurable: 'd',
          },
          { user: { userId: 'u-1' } },
          'wellness'
        )
      ).rejects.toMatchObject({
        message: 'Failed to create DailyFour entry',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('converts a read failure into a 500', async () => {
      wellnessClient.send.mockReturnValue(
        throwError(() => new Error('db down'))
      );

      await expect(controller.getDailyFour({})).rejects.toMatchObject({
        message: 'Failed to fetch DailyFour entries',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('treats any publicOnly value other than the string "true" as a per-user read', async () => {
      wellnessClient.send.mockReturnValue(of([]));

      await controller.getDailyFour({ user: { userId: 'u-1' } }, 'false');

      expect(lastPattern(wellnessClient)).toEqual({
        cmd: WellnessCommands.GET_DAILY_FOUR_BY_USER,
      });
      expect(lastPayload(wellnessClient)).toBe('u-1');
    });
  });

  describe('daily six writes', () => {
    it('updates an entry by id with the dto nested', async () => {
      wellnessClient.send.mockReturnValue(of({ id: 'ds-1' }));

      await expect(
        controller.updateDailySix('ds-1', { judgement: 'harsh' })
      ).resolves.toEqual({ id: 'ds-1' });

      expect(lastPattern(wellnessClient)).toEqual({
        cmd: WellnessCommands.UPDATE_DAILY_SIX,
      });
      expect(lastPayload(wellnessClient)).toEqual({
        id: 'ds-1',
        dto: { judgement: 'harsh' },
      });
    });

    it('converts an update failure into a 500', async () => {
      wellnessClient.send.mockReturnValue(
        throwError(() => new Error('db down'))
      );

      await expect(controller.updateDailySix('ds-1', {})).rejects.toMatchObject(
        {
          message: 'Failed to update DailySix entry',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        }
      );
    });

    it('deletes an entry by id', async () => {
      wellnessClient.send.mockReturnValue(of({ deleted: true }));

      await expect(controller.deleteDailySix('ds-1')).resolves.toEqual({
        deleted: true,
      });
      expect(lastPattern(wellnessClient)).toEqual({
        cmd: WellnessCommands.DELETE_DAILY_SIX,
      });
      expect(lastPayload(wellnessClient)).toEqual({ id: 'ds-1' });
    });

    it('converts a delete failure into a 500', async () => {
      wellnessClient.send.mockReturnValue(
        throwError(() => new Error('db down'))
      );

      await expect(controller.deleteDailySix('ds-1')).rejects.toMatchObject({
        message: 'Failed to delete DailySix entry',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('converts a create failure into a 500', async () => {
      wellnessClient.send.mockReturnValue(
        throwError(() => new Error('db down'))
      );

      await expect(
        controller.createDailySix(
          {
            affirmation: 'a',
            judgement: 'b',
            nonJudgement: 'c',
            mindfulActivity: 'd',
            gratitude: 'e',
          },
          { user: { userId: 'u-1' } },
          'wellness'
        )
      ).rejects.toMatchObject({
        message: 'Failed to create DailySix entry',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });

    it('serves publicOnly reads without any identity', async () => {
      wellnessClient.send.mockReturnValue(of([]));

      await controller.getDailySix({}, 'true');

      expect(lastPattern(wellnessClient)).toEqual({
        cmd: WellnessCommands.GET_DAILY_SIX_ALL,
      });
      expect(lastPayload(wellnessClient)).toEqual({ publicOnly: true });
    });

    it('converts a read failure into a 500', async () => {
      wellnessClient.send.mockReturnValue(
        throwError(() => new Error('db down'))
      );

      await expect(controller.getDailySix({}, 'true')).rejects.toMatchObject({
        message: 'Failed to fetch DailySix entries',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
});
