import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';

import { WellnessController } from './wellness.controller';
import { DailyFourService } from './services/daily-four.service';
import { DailySixService } from './services/daily-six.service';

/**
 * The controller is a thin message-pattern facade over the two services: every
 * handler forwards its payload and returns the service's result untouched.
 * What is worth pinning is the wiring — that each command reaches the right
 * service method with the payload unpacked the way the handler declares it,
 * since a Daily Four handler calling a Daily Six service would otherwise be
 * silent.
 */

interface ServiceMock {
  create: jest.Mock;
  findByProfileId: jest.Mock;
  findAll: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
}

const serviceMock = (): ServiceMock => ({
  create: jest.fn(async () => ({ id: 'created' })),
  findByProfileId: jest.fn(async () => [{ id: 'by-profile' }]),
  findAll: jest.fn(async () => [{ id: 'all' }]),
  update: jest.fn(async () => ({ id: 'updated' })),
  delete: jest.fn(async () => undefined),
});

describe('WellnessController', () => {
  let controller: WellnessController;
  let dailyFour: ServiceMock;
  let dailySix: ServiceMock;

  beforeEach(async () => {
    dailyFour = serviceMock();
    dailySix = serviceMock();

    const moduleRef = await Test.createTestingModule({
      controllers: [WellnessController],
      providers: [
        { provide: DailyFourService, useValue: dailyFour },
        { provide: DailySixService, useValue: dailySix },
      ],
    }).compile();

    controller = moduleRef.get(WellnessController);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('daily four', () => {
    it('creates against the daily four service', async () => {
      const dto = {
        affirmation: 'A',
        mindfulActivity: 'B',
        gratitude: 'C',
        plannedPleasurable: 'D',
      };

      const result = await controller.createDailyFour({
        profileId: 'profile-1',
        dto,
      });

      expect(dailyFour.create).toHaveBeenCalledWith('profile-1', dto);
      expect(dailySix.create).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'created' });
    });

    it('reads a profile’s entries', async () => {
      const result = await controller.getDailyFourByProfile('profile-1');

      expect(dailyFour.findByProfileId).toHaveBeenCalledWith('profile-1');
      expect(result).toEqual([{ id: 'by-profile' }]);
    });

    it.each([
      ['passes the public-only flag through', true],
      ['passes an explicit false through', false],
      ['passes undefined when the flag is absent', undefined],
    ])('%s', async (_case, publicOnly) => {
      const result = await controller.getAllDailyFour(publicOnly);

      expect(dailyFour.findAll).toHaveBeenCalledWith(publicOnly);
      expect(result).toEqual([{ id: 'all' }]);
    });

    it('updates with the id, profile and patch split out', async () => {
      const result = await controller.updateDailyFour({
        id: 'entry-1',
        profileId: 'profile-1',
        dto: { affirmation: 'New' },
      });

      expect(dailyFour.update).toHaveBeenCalledWith('entry-1', 'profile-1', {
        affirmation: 'New',
      });
      expect(result).toEqual({ id: 'updated' });
    });

    it('deletes with the id and profile split out', async () => {
      await controller.deleteDailyFour({
        id: 'entry-1',
        profileId: 'profile-1',
      });

      expect(dailyFour.delete).toHaveBeenCalledWith('entry-1', 'profile-1');
      expect(dailySix.delete).not.toHaveBeenCalled();
    });
  });

  describe('daily six', () => {
    it('creates against the daily six service', async () => {
      const dto = {
        affirmation: 'A',
        judgement: 'B',
        nonJudgement: 'C',
        mindfulActivity: 'D',
        gratitude: 'E',
      };

      const result = await controller.createDailySix({
        profileId: 'profile-1',
        dto,
      });

      expect(dailySix.create).toHaveBeenCalledWith('profile-1', dto);
      expect(dailyFour.create).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'created' });
    });

    it('reads a profile’s entries', async () => {
      const result = await controller.getDailySixByProfile('profile-1');

      expect(dailySix.findByProfileId).toHaveBeenCalledWith('profile-1');
      expect(result).toEqual([{ id: 'by-profile' }]);
    });

    it.each([
      ['passes the public-only flag through', true],
      ['passes an explicit false through', false],
      ['passes undefined when the flag is absent', undefined],
    ])('%s', async (_case, publicOnly) => {
      const result = await controller.getAllDailySix(publicOnly);

      expect(dailySix.findAll).toHaveBeenCalledWith(publicOnly);
      expect(result).toEqual([{ id: 'all' }]);
    });

    it('updates with the id, profile and patch split out', async () => {
      const result = await controller.updateDailySix({
        id: 'entry-1',
        profileId: 'profile-1',
        dto: { affirmation: 'New' },
      });

      expect(dailySix.update).toHaveBeenCalledWith('entry-1', 'profile-1', {
        affirmation: 'New',
      });
      expect(result).toEqual({ id: 'updated' });
    });

    it('deletes with the id and profile split out', async () => {
      await controller.deleteDailySix({
        id: 'entry-1',
        profileId: 'profile-1',
      });

      expect(dailySix.delete).toHaveBeenCalledWith('entry-1', 'profile-1');
      expect(dailyFour.delete).not.toHaveBeenCalled();
    });
  });

  describe('error propagation', () => {
    it('lets a service rejection reach the caller', async () => {
      dailyFour.update.mockRejectedValue(new Error('not authorized'));

      await expect(
        controller.updateDailyFour({
          id: 'entry-1',
          profileId: 'someone-else',
          dto: {},
        })
      ).rejects.toThrow('not authorized');
    });
  });
});
