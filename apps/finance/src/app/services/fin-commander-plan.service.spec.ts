import { NotFoundException } from '@nestjs/common';

import { FinCommanderPlanService } from './fin-commander-plan.service';
import { FinanceScope } from './finance-scope';

jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: { sanitize: jest.fn((value: string) => `clean(${value})`) },
}));

/**
 * Plans are tenant-scoped, so every read has to carry the caller's scope into
 * the where clause — a lookup that forgot it would hand one tenant another
 * tenant's plan. The write paths sanitize the free-text fields.
 */
interface PlanRepoMock {
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
}

describe('FinCommanderPlanService', () => {
  let repo: PlanRepoMock;
  let service: FinCommanderPlanService;

  const scope: FinanceScope = { tenantId: 'tenant-1', userId: 'user-1' };
  const plan = { id: 'plan-1', name: 'clean(Runway)', tenantId: 'tenant-1' };

  beforeEach(() => {
    repo = {
      create: jest.fn((input: unknown) => input),
      save: jest.fn(async (input: unknown) => input),
      find: jest.fn().mockResolvedValue([plan]),
      findOne: jest.fn().mockResolvedValue(plan),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    service = new FinCommanderPlanService(repo as never);
  });

  describe('create', () => {
    it('sanitizes the name and description before saving', async () => {
      const saved = await service.create({
        name: '<b>Runway</b>',
        description: '<script>alert(1)</script>',
        tenantId: 'tenant-1',
      } as never);

      expect(saved).toMatchObject({
        name: 'clean(<b>Runway</b>)',
        description: 'clean(<script>alert(1)</script>)',
        tenantId: 'tenant-1',
      });
    });

    it('stores a null description when none was supplied', async () => {
      const saved = (await service.create({
        name: 'Runway',
        tenantId: 'tenant-1',
      } as never)) as unknown as { description: string | null };

      expect(saved.description).toBeNull();
    });
  });

  describe('reads', () => {
    it('applies the scope to the list query', async () => {
      await expect(service.findAll(scope)).resolves.toEqual([plan]);

      expect(repo.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', userId: 'user-1' },
      });
    });

    it('keeps caller options alongside the scope', async () => {
      await service.findAll(scope, { order: { name: 'ASC' } });

      expect(repo.find).toHaveBeenCalledWith({
        order: { name: 'ASC' },
        where: { tenantId: 'tenant-1', userId: 'user-1' },
      });
    });

    it('constrains a single lookup by both id and scope', async () => {
      await expect(service.findOne('plan-1', scope)).resolves.toEqual(plan);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'plan-1', tenantId: 'tenant-1', userId: 'user-1' },
      });
    });

    it('looks up by id alone when there is no scope', async () => {
      await service.findOne('plan-1');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'plan-1' } });
    });
  });

  describe('assertAccess', () => {
    it('resolves for a plan inside the scope', async () => {
      await expect(
        service.assertAccess('plan-1', scope)
      ).resolves.toBeUndefined();
    });

    it('throws when the plan is outside the scope', async () => {
      // The row may well exist; it is simply not this caller's.
      repo.findOne.mockResolvedValue(null);

      await expect(service.assertAccess('plan-1', scope)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('update', () => {
    it('sanitizes the fields that were supplied and leaves the rest alone', async () => {
      await service.update(
        'plan-1',
        {
          name: '<i>Runway v2</i>',
          defaultWorkspace: 'business',
        } as never,
        scope
      );

      expect(repo.update).toHaveBeenCalledWith('plan-1', {
        name: 'clean(<i>Runway v2</i>)',
        defaultWorkspace: 'business',
      });
    });

    it('clears the description when it is explicitly emptied', async () => {
      // An empty string is a deliberate clear, not "unchanged", so it maps to
      // null rather than being sanitized into an empty string.
      await service.update('plan-1', { description: '' } as never, scope);

      expect(repo.update).toHaveBeenCalledWith('plan-1', {
        description: null,
      });
    });

    it('sanitizes a replacement description', async () => {
      await service.update(
        'plan-1',
        { description: '<b>New</b>' } as never,
        scope
      );

      expect(repo.update).toHaveBeenCalledWith('plan-1', {
        description: 'clean(<b>New</b>)',
      });
    });

    it('sends no fields at all for an empty patch', async () => {
      await service.update('plan-1', {} as never, scope);

      expect(repo.update).toHaveBeenCalledWith('plan-1', {});
    });

    it('refuses to update a plan outside the scope', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update('plan-1', { name: 'Hijack' } as never, scope)
      ).rejects.toThrow('Plan with ID plan-1 not found');
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes a plan inside the scope', async () => {
      await expect(service.remove('plan-1', scope)).resolves.toBeUndefined();

      expect(repo.delete).toHaveBeenCalledWith('plan-1');
    });

    it('refuses to delete a plan outside the scope', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('plan-1', scope)).rejects.toThrow(
        NotFoundException
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
