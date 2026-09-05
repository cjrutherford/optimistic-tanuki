import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { FinCommanderPlanStore } from './fin-commander-plan-store.service';
import { FinanceService } from '@optimistic-tanuki/finance-ui';
import { FinCommanderPlanApiService } from './fin-commander-plan-api.service';

describe('FinCommanderPlanStore', () => {
  const localStorageState = new Map<string, string>();
  const apiPlans = [
    {
      id: 'api-plan',
      name: 'API plan',
      description: 'Persisted by the tenant API',
      defaultWorkspace: 'personal' as const,
      updatedAt: '2026-08-11T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    localStorageState.clear();

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => localStorageState.get(key) ?? null,
        setItem: (key: string, value: string) =>
          localStorageState.set(key, value),
        removeItem: (key: string) => localStorageState.delete(key),
      },
    });

    TestBed.configureTestingModule({
      providers: [
        FinCommanderPlanStore,
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: FinanceService,
          useValue: {
            getWorkspaceSummary: jest.fn(),
          },
        },
        {
          provide: FinCommanderPlanApiService,
          useValue: {
            listPlans: jest.fn().mockResolvedValue(apiPlans),
            createPlan: jest.fn().mockResolvedValue(apiPlans[0]),
            listGoals: jest.fn().mockResolvedValue([]),
            saveGoal: jest.fn().mockResolvedValue(undefined),
            deleteGoal: jest.fn().mockResolvedValue(undefined),
            listScenarios: jest.fn().mockResolvedValue([]),
            saveScenario: jest.fn().mockResolvedValue(undefined),
            deleteScenario: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });
  });

  it('hydrates plans from the tenant API and never restores browser-local records', async () => {
    const store = TestBed.inject(FinCommanderPlanStore);

    localStorageState.set(
      'fin-commander.plans.tenant-a.profile-a',
      JSON.stringify([
        {
          id: 'legacy-local-plan',
          name: 'Legacy browser plan',
        },
      ])
    );
    store.setScope({ tenantId: 'tenant-a', profileId: 'profile-a' });
    await store.refreshPlans();

    expect(store.listPlans()).toEqual(apiPlans);
    expect(store.getPlan('legacy-local-plan')).toBeNull();
  });

  it('delegates persistence operations through an API seam', async () => {
    const store = TestBed.inject(FinCommanderPlanStore);
    const api = TestBed.inject(FinCommanderPlanApiService);

    store.setScope({ tenantId: 'tenant-a', profileId: 'profile-a' });

    await store.refreshPlans();

    expect(api.listPlans).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      profileId: 'profile-a',
    });
  });

  it('returns zero seeded plans for a real scoped user with no stored data', () => {
    const store = TestBed.inject(FinCommanderPlanStore);

    store.setScope({ tenantId: 'tenant-a', profileId: 'profile-a' });

    expect(store.listPlans()).toEqual([]);
  });

  it('uses the server-issued plan id after a create', async () => {
    const store = TestBed.inject(FinCommanderPlanStore);

    store.setScope({ tenantId: 'tenant-a', profileId: 'profile-a' });
    const persisted = await store.savePlan({
      id: 'browser-generated-id',
      name: 'New plan',
      description: 'Created through the API',
      defaultWorkspace: 'personal',
      updatedAt: '2026-08-11T00:00:00.000Z',
    });

    expect(persisted.id).toBe('api-plan');
    expect(store.listPlans()).toEqual(apiPlans);
  });

  it('getScope returns null until a scope is set', () => {
    const store = TestBed.inject(FinCommanderPlanStore);
    expect(store.getScope()).toBeNull();
    store.setScope({ tenantId: 'tenant-a', profileId: 'profile-a' });
    expect(store.getScope()).toEqual({
      tenantId: 'tenant-a',
      profileId: 'profile-a',
    });
  });

  it('refreshPlans resolves to [] without a scope', async () => {
    const store = TestBed.inject(FinCommanderPlanStore);
    await expect(store.refreshPlans()).resolves.toEqual([]);
  });

  it('drops a stale refreshPlans response once the scope has been cleared', async () => {
    const store = TestBed.inject(FinCommanderPlanStore);
    const api = TestBed.inject(FinCommanderPlanApiService);
    let resolvePlans!: (plans: typeof apiPlans) => void;
    (api.listPlans as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => (resolvePlans = resolve))
    );

    store.setScope({ tenantId: 'tenant-a', profileId: 'profile-a' });
    const pending = store.refreshPlans();
    store.setScope(null);
    resolvePlans(apiPlans);
    await pending;

    expect(store.listPlans()).toEqual([]);
  });

  describe('goals', () => {
    it('throws when saving a goal without a scope', async () => {
      const store = TestBed.inject(FinCommanderPlanStore);
      await expect(
        store.saveGoal({ id: 'g1', planId: 'p1' } as any)
      ).rejects.toThrow(
        'An active tenant scope is required for planning changes'
      );
    });

    it('refreshGoals returns [] without a scope or planId', async () => {
      const store = TestBed.inject(FinCommanderPlanStore);
      await expect(store.refreshGoals('')).resolves.toEqual([]);
    });

    it('refreshes, filters, saves and deletes goals scoped to a plan', async () => {
      const store = TestBed.inject(FinCommanderPlanStore);
      const api = TestBed.inject(FinCommanderPlanApiService);
      const goal = { id: 'g1', planId: 'p1', name: 'Goal 1' };
      (api.listGoals as jest.Mock).mockResolvedValue([goal]);
      (api.saveGoal as jest.Mock).mockResolvedValue(goal);

      store.setScope({ tenantId: 'tenant-a', profileId: 'profile-a' });
      await store.refreshGoals('p1');

      expect(store.listGoals('p1')).toEqual([goal]);
      expect(store.listGoals('other-plan')).toEqual([]);

      const saved = await store.saveGoal(goal as any);
      expect(saved).toEqual(goal);
      expect(store.listGoals('p1')).toEqual([goal]);

      await store.deleteGoal('g1');
      expect(store.listGoals('p1')).toEqual([]);
    });

    it('previews, approves and cancels funding directives through the API', async () => {
      const store = TestBed.inject(FinCommanderPlanStore);
      const api = TestBed.inject(FinCommanderPlanApiService);
      (api as any).previewFundingDirective = jest
        .fn()
        .mockResolvedValue({ amountCents: 100 });
      (api as any).approveFundingDirective = jest
        .fn()
        .mockResolvedValue({ id: 'fd1' });
      (api as any).cancelFundingDirective = jest
        .fn()
        .mockResolvedValue({ id: 'fd1' });

      store.setScope({ tenantId: 'tenant-a', profileId: 'profile-a' });

      await expect(store.previewFundingDirective('g1')).resolves.toEqual({
        amountCents: 100,
      });
      await expect(store.approveFundingDirective('g1')).resolves.toEqual({
        id: 'fd1',
      });
      await expect(store.cancelFundingDirective('g1')).resolves.toEqual({
        id: 'fd1',
      });
    });
  });

  describe('scenarios', () => {
    it('throws when saving a scenario without a scope', async () => {
      const store = TestBed.inject(FinCommanderPlanStore);
      await expect(
        store.saveScenario({ id: 's1', planId: 'p1' } as any)
      ).rejects.toThrow(
        'An active tenant scope is required for planning changes'
      );
    });

    it('refreshScenarios returns [] without a scope or planId', async () => {
      const store = TestBed.inject(FinCommanderPlanStore);
      await expect(store.refreshScenarios('')).resolves.toEqual([]);
    });

    it('refreshes, filters, saves and deletes scenarios scoped to a plan', async () => {
      const store = TestBed.inject(FinCommanderPlanStore);
      const api = TestBed.inject(FinCommanderPlanApiService);
      const scenario = { id: 's1', planId: 'p1', name: 'Scenario 1' };
      (api.listScenarios as jest.Mock).mockResolvedValue([scenario]);
      (api.saveScenario as jest.Mock).mockResolvedValue(scenario);

      store.setScope({ tenantId: 'tenant-a', profileId: 'profile-a' });
      await store.refreshScenarios('p1');

      expect(store.listScenarios('p1')).toEqual([scenario]);
      expect(store.listScenarios('other-plan')).toEqual([]);

      const saved = await store.saveScenario(scenario as any);
      expect(saved).toEqual(scenario);

      await store.deleteScenario('s1');
      expect(store.listScenarios('p1')).toEqual([]);
    });
  });

  describe('buildOverview', () => {
    it('throws when the plan is not found', async () => {
      const store = TestBed.inject(FinCommanderPlanStore);
      store.setScope({ tenantId: 'tenant-a', profileId: 'profile-a' });
      await expect(store.buildOverview('missing')).rejects.toThrow(
        'Plan missing not found'
      );
    });

    it('assembles goals, scenarios, and per-workspace summaries', async () => {
      const store = TestBed.inject(FinCommanderPlanStore);
      const api = TestBed.inject(FinCommanderPlanApiService);
      const financeService = TestBed.inject(FinanceService);
      (api.listGoals as jest.Mock).mockResolvedValue([]);
      (api.listScenarios as jest.Mock).mockResolvedValue([]);
      (financeService.getWorkspaceSummary as jest.Mock).mockImplementation(
        (workspace: string) => {
          if (workspace === 'personal') {
            return Promise.resolve({ total: 100 });
          }
          return Promise.reject(new Error('unavailable'));
        }
      );

      store.setScope({ tenantId: 'tenant-a', profileId: 'profile-a' });
      await store.refreshPlans();

      const overview = await store.buildOverview('api-plan');

      expect(overview.plan).toEqual(apiPlans[0]);
      expect(overview.goals).toEqual([]);
      expect(overview.scenarios).toEqual([]);
      expect(overview.workspaces).toEqual([
        { workspace: 'personal', summary: { total: 100 }, available: true },
        { workspace: 'business', summary: null, available: false },
        { workspace: 'net-worth', summary: null, available: false },
      ]);
    });
  });
});
