import { NotFoundException } from '@nestjs/common';

import { FinCommanderScenarioService } from './fin-commander-scenario.service';
import { FinanceScope } from './finance-scope';

jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: { sanitize: jest.fn((value: string) => `clean(${value})`) },
}));

/**
 * Scenarios carry a free-text assumption list that is rendered back to the
 * user, so the sanitizing has to reach inside the array rather than stopping at
 * the top-level fields. Reads are tenant-scoped like the rest of finance.
 */
interface ScenarioRepoMock {
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
}

describe('FinCommanderScenarioService', () => {
  let repo: ScenarioRepoMock;
  let service: FinCommanderScenarioService;

  const scope: FinanceScope = { tenantId: 'tenant-1' };
  const scenario = { id: 'scenario-1', name: 'clean(Downturn)' };

  beforeEach(() => {
    repo = {
      create: jest.fn((input: unknown) => input),
      save: jest.fn(async (input: unknown) => input),
      find: jest.fn().mockResolvedValue([scenario]),
      findOne: jest.fn().mockResolvedValue(scenario),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    service = new FinCommanderScenarioService(repo as never);
  });

  describe('create', () => {
    it('sanitizes the name, summary and every assumption', async () => {
      const saved = (await service.create({
        name: '<b>Downturn</b>',
        summary: '<i>Revenue falls</i>',
        assumptions: [
          {
            id: 'a1',
            label: '<script>x</script>',
            delta: '-20%',
            impactArea: 'revenue',
          },
        ],
        tenantId: 'tenant-1',
      } as never)) as unknown as {
        name: string;
        summary: string;
        assumptions: { id: string; label: string; delta: string }[];
      };

      expect(saved.name).toBe('clean(<b>Downturn</b>)');
      expect(saved.summary).toBe('clean(<i>Revenue falls</i>)');
      expect(saved.assumptions).toEqual([
        {
          id: 'a1',
          label: 'clean(<script>x</script>)',
          delta: 'clean(-20%)',
          // The impact area is a fixed enum, so it passes through untouched.
          impactArea: 'revenue',
        },
      ]);
    });

    it('defaults a missing summary to an empty string and assumptions to none', async () => {
      const saved = (await service.create({
        name: 'Downturn',
        tenantId: 'tenant-1',
      } as never)) as unknown as { summary: string; assumptions: unknown[] };

      expect(saved.summary).toBe('');
      expect(saved.assumptions).toEqual([]);
    });
  });

  describe('reads', () => {
    it('applies the scope to the list query', async () => {
      await expect(service.findAll(scope)).resolves.toEqual([scenario]);

      expect(repo.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
      });
    });

    it('constrains a single lookup by both id and scope', async () => {
      await service.findOne('scenario-1', scope);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 'scenario-1', tenantId: 'tenant-1' },
      });
    });
  });

  describe('update', () => {
    it('sanitizes a replacement name and summary', async () => {
      await service.update(
        'scenario-1',
        { name: '<b>Worse</b>', summary: '<i>Much worse</i>' } as never,
        scope
      );

      expect(repo.update).toHaveBeenCalledWith('scenario-1', {
        name: 'clean(<b>Worse</b>)',
        summary: 'clean(<i>Much worse</i>)',
      });
    });

    it('replaces the assumption list wholesale, sanitizing as it goes', async () => {
      await service.update(
        'scenario-1',
        {
          assumptions: [
            {
              id: 'a2',
              label: '<b>Churn</b>',
              delta: '+5%',
              impactArea: 'costs',
            },
          ],
        } as never,
        scope
      );

      expect(repo.update).toHaveBeenCalledWith('scenario-1', {
        assumptions: [
          {
            id: 'a2',
            label: 'clean(<b>Churn</b>)',
            delta: 'clean(+5%)',
            impactArea: 'costs',
          },
        ],
      });
    });

    it('clears the assumptions when an empty list is sent', async () => {
      await service.update('scenario-1', { assumptions: [] } as never, scope);

      expect(repo.update).toHaveBeenCalledWith('scenario-1', {
        assumptions: [],
      });
    });

    it('refuses to update a scenario outside the scope', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update('scenario-1', { name: 'Hijack' } as never, scope)
      ).rejects.toThrow('Scenario with ID scenario-1 not found');
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes a scenario inside the scope', async () => {
      await expect(
        service.remove('scenario-1', scope)
      ).resolves.toBeUndefined();

      expect(repo.delete).toHaveBeenCalledWith('scenario-1');
    });

    it('refuses to delete a scenario outside the scope', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove('scenario-1', scope)).rejects.toThrow(
        NotFoundException
      );
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
