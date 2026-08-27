import { of } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { WellnessCommands } from '@optimistic-tanuki/constants';
import { WellnessController } from './wellness.controller';
import { AuthGuard } from '../../auth/auth.guard';

describe('WellnessController', () => {
  let wellnessClient: jest.Mocked<ClientProxy>;
  let aiOrchestrationClient: jest.Mocked<ClientProxy>;
  let controller: WellnessController;

  beforeEach(() => {
    wellnessClient = {
      send: jest.fn().mockReturnValue(of({})),
      connect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientProxy>;
    aiOrchestrationClient = {
      send: jest.fn().mockReturnValue(of({})),
      connect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientProxy>;

    controller = new WellnessController(wellnessClient, aiOrchestrationClient);
  });

  // These routes used to have NO guard at all, and read the acting userId via
  // the `@User()` decorator, which decodes the JWT payload WITHOUT verifying
  // its signature. AuthGuard now runs (as @Public()+@UseGuards(AuthGuard), so
  // `?publicOnly=true` browsing still works with no token) and the handlers
  // read the guard-verified `request.user` instead.
  it('guards daily-four/daily-six create+read routes with AuthGuard', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        WellnessController.prototype.createDailyFour
      )
    ).toEqual(expect.arrayContaining([AuthGuard]));
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        WellnessController.prototype.getDailyFour
      )
    ).toEqual(expect.arrayContaining([AuthGuard]));
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        WellnessController.prototype.createDailySix
      )
    ).toEqual(expect.arrayContaining([AuthGuard]));
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        WellnessController.prototype.getDailySix
      )
    ).toEqual(expect.arrayContaining([AuthGuard]));
  });

  describe('createDailyFour', () => {
    const dto = {
      affirmation: 'a',
      mindfulActivity: 'b',
      gratitude: 'c',
      plannedPleasurable: 'd',
    };

    it('forwards the guard-verified userId when a valid token is present', async () => {
      await controller.createDailyFour(
        dto,
        { user: { userId: 'verified-user-1' } },
        'wellness'
      );

      expect(wellnessClient.send).toHaveBeenCalledWith(
        { cmd: WellnessCommands.CREATE_DAILY_FOUR },
        { userId: 'verified-user-1', dto }
      );
    });

    it('forwards an undefined userId for an anonymous or forged-token request', async () => {
      await controller.createDailyFour(dto, {}, 'wellness');

      expect(wellnessClient.send).toHaveBeenCalledWith(
        { cmd: WellnessCommands.CREATE_DAILY_FOUR },
        { userId: undefined, dto }
      );
    });
  });

  describe('getDailyFour', () => {
    it('forwards the guard-verified userId when fetching entries by user', async () => {
      await controller.getDailyFour({ user: { userId: 'verified-user-1' } });

      expect(wellnessClient.send).toHaveBeenCalledWith(
        { cmd: WellnessCommands.GET_DAILY_FOUR_BY_USER },
        'verified-user-1'
      );
    });

    it('forwards an undefined userId for an anonymous or forged-token request', async () => {
      await controller.getDailyFour({});

      expect(wellnessClient.send).toHaveBeenCalledWith(
        { cmd: WellnessCommands.GET_DAILY_FOUR_BY_USER },
        undefined
      );
    });

    it('serves publicOnly requests without requiring any identity', async () => {
      await controller.getDailyFour({}, 'true');

      expect(wellnessClient.send).toHaveBeenCalledWith(
        { cmd: WellnessCommands.GET_DAILY_FOUR_ALL },
        { publicOnly: true }
      );
    });
  });

  describe('createDailySix', () => {
    const dto = {
      affirmation: 'a',
      judgement: 'b',
      nonJudgement: 'c',
      mindfulActivity: 'd',
      gratitude: 'e',
    };

    it('forwards the guard-verified userId when a valid token is present', async () => {
      await controller.createDailySix(
        dto,
        { user: { userId: 'verified-user-1' } },
        'wellness'
      );

      expect(wellnessClient.send).toHaveBeenCalledWith(
        { cmd: WellnessCommands.CREATE_DAILY_SIX },
        { userId: 'verified-user-1', dto }
      );
    });

    it('forwards an undefined userId for an anonymous or forged-token request', async () => {
      await controller.createDailySix(dto, {}, 'wellness');

      expect(wellnessClient.send).toHaveBeenCalledWith(
        { cmd: WellnessCommands.CREATE_DAILY_SIX },
        { userId: undefined, dto }
      );
    });
  });

  describe('getDailySix', () => {
    it('forwards the guard-verified userId when fetching entries by user', async () => {
      await controller.getDailySix({ user: { userId: 'verified-user-1' } });

      expect(wellnessClient.send).toHaveBeenCalledWith(
        { cmd: WellnessCommands.GET_DAILY_SIX_BY_USER },
        'verified-user-1'
      );
    });

    it('forwards an undefined userId for an anonymous or forged-token request', async () => {
      await controller.getDailySix({});

      expect(wellnessClient.send).toHaveBeenCalledWith(
        { cmd: WellnessCommands.GET_DAILY_SIX_BY_USER },
        undefined
      );
    });
  });
});
