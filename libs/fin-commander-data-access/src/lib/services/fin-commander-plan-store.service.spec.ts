import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { FinCommanderPlanStore } from './fin-commander-plan-store.service';
import { FinanceService } from '@optimistic-tanuki/finance-ui';
import { FinCommanderPlanApiService } from './fin-commander-plan-api.service';

describe('FinCommanderPlanStore', () => {
  const localStorageState = new Map<string, string>();

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
            listPlans: jest.fn().mockResolvedValue([]),
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

  it('stores goal collections by tenant and profile scope instead of browser-global keys', () => {
    const store = TestBed.inject(FinCommanderPlanStore);

    store.setScope({ tenantId: 'tenant-a', profileId: 'profile-a' });
    store.saveGoal({
      id: 'goal-a',
      planId: 'home-command',
      name: 'Tenant A goal',
      targetAmount: 1000,
      currentAmount: 100,
      dueDate: '2026-05-01',
      strategy: 'Save monthly',
    });

    store.setScope({ tenantId: 'tenant-b', profileId: 'profile-b' });
    store.saveGoal({
      id: 'goal-b',
      planId: 'home-command',
      name: 'Tenant B goal',
      targetAmount: 2000,
      currentAmount: 200,
      dueDate: '2026-06-01',
      strategy: 'Save weekly',
    });

    expect(localStorageState.has('fin-commander.goals')).toBe(false);
    expect(Array.from(localStorageState.keys()).sort()).toEqual([
      'fin-commander.goals.tenant-a.profile-a',
      'fin-commander.goals.tenant-b.profile-b',
    ]);

    store.setScope({ tenantId: 'tenant-a', profileId: 'profile-a' });
    expect(store.listGoals('home-command').map((goal) => goal.id)).toEqual([
      'goal-a',
    ]);

    store.setScope({ tenantId: 'tenant-b', profileId: 'profile-b' });
    expect(store.listGoals('home-command').map((goal) => goal.id)).toEqual([
      'goal-b',
    ]);
  });

  it('delegates persistence operations through an API seam', async () => {
    const store = TestBed.inject(FinCommanderPlanStore);
    const api = TestBed.inject(FinCommanderPlanApiService);

    store.setScope({ tenantId: 'tenant-a', profileId: 'profile-a' });

    await store.listPlansAsync();

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
});
