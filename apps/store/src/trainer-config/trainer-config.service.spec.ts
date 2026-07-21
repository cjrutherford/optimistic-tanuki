import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { TrainerConfigService } from './trainer-config.service';
import { TrainerSiteConfigEntity } from './entities/trainer-site-config.entity';

describe('TrainerConfigService', () => {
  const buildService = (config: Partial<TrainerSiteConfigEntity> | null) => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(config),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    } as any;

    const service = new TrainerConfigService(repository, new Logger());

    return { service, repository };
  };

  describe('updateConfig', () => {
    it('rejects updates from a caller who does not own the config', async () => {
      const { service, repository } = buildService({
        id: 'cfg-1',
        leadContext: {
          profileId: 'owner-profile-1',
          appScope: 'business-site',
        },
      });

      await expect(
        service.updateConfig(
          'cfg-1',
          { brand: { businessName: 'Hijacked Business' } },
          'attacker-profile-1'
        )
      ).rejects.toThrow(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('allows the recorded owner to update their own config', async () => {
      const { service, repository } = buildService({
        id: 'cfg-1',
        leadContext: {
          profileId: 'owner-profile-1',
          appScope: 'business-site',
        },
      });

      await expect(
        service.updateConfig(
          'cfg-1',
          { brand: { businessName: 'Refreshed Business' } },
          'owner-profile-1'
        )
      ).resolves.toEqual(
        expect.objectContaining({
          brand: { businessName: 'Refreshed Business' },
        })
      );

      expect(repository.save).toHaveBeenCalled();
    });

    it('allows updates when no requester profile is supplied (internal/trusted callers)', async () => {
      const { service, repository } = buildService({
        id: 'cfg-1',
        leadContext: {
          profileId: 'owner-profile-1',
          appScope: 'business-site',
        },
      });

      await expect(
        service.updateConfig('cfg-1', {
          brand: { businessName: 'Internal Update' },
        })
      ).resolves.toEqual(
        expect.objectContaining({ brand: { businessName: 'Internal Update' } })
      );

      expect(repository.save).toHaveBeenCalled();
    });

    it('allows claiming a legacy config with no recorded owner', async () => {
      const { service, repository } = buildService({
        id: 'cfg-1',
        leadContext: undefined,
      });

      await expect(
        service.updateConfig(
          'cfg-1',
          { brand: { businessName: 'Claimed Business' } },
          'new-owner-profile'
        )
      ).resolves.toEqual(
        expect.objectContaining({ brand: { businessName: 'Claimed Business' } })
      );

      expect(repository.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when the config does not exist', async () => {
      const { service } = buildService(null);

      await expect(
        service.updateConfig('missing-cfg', {}, 'owner-profile-1')
      ).rejects.toThrow(NotFoundException);
    });
  });
});
