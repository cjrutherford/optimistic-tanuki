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
});
