import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';
import {
  FinCommanderPlanStore,
  type FinCommanderGoal,
  type FinCommanderScope,
} from '@optimistic-tanuki/fin-commander-data-access';
import { GoalsPageComponent } from './goals-page.component';

describe('GoalsPageComponent', () => {
  it('reloads visible goals when the active tenant/profile scope changes', async () => {
    const scope = signal<FinCommanderScope | null>({
      tenantId: 'tenant-a',
      profileId: 'profile-a',
    });
    const goalsByScope = new Map<string, FinCommanderGoal[]>([
      [
        'tenant-a.profile-a',
        [
          {
            id: 'goal-a',
            planId: 'tenant-plan',
            name: 'Tenant A Goal',
            targetAmount: 1000,
            currentAmount: 250,
            dueDate: '2026-06-01',
            strategy: 'Save monthly',
          },
        ],
      ],
      [
        'tenant-b.profile-b',
        [
          {
            id: 'goal-b',
            planId: 'tenant-plan',
            name: 'Tenant B Goal',
            targetAmount: 2500,
            currentAmount: 700,
            dueDate: '2026-07-01',
            strategy: 'Transfer weekly',
          },
        ],
      ],
    ]);

    await TestBed.configureTestingModule({
      imports: [GoalsPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ planId: 'tenant-plan' }),
            },
            paramMap: of(convertToParamMap({ planId: 'tenant-plan' })),
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            getScope: () => scope(),
            listPlans: () => [
              {
                id: 'tenant-plan',
                name: 'Tenant Plan',
                description: 'Scoped plan',
                defaultWorkspace: 'personal',
                updatedAt: '2026-04-13',
              },
            ],
            listGoals: (planId: string) => {
              const activeScope = scope();
              if (!activeScope || planId !== 'tenant-plan') {
                return [];
              }

              return (
                goalsByScope.get(
                  `${activeScope.tenantId}.${activeScope.profileId}`
                ) ?? []
              );
            },
            saveGoal: jest.fn(),
            deleteGoal: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(GoalsPageComponent);
    fixture.detectChanges();
    await Promise.resolve();

    expect(fixture.nativeElement.textContent).toContain('Tenant A Goal');
    expect(fixture.nativeElement.textContent).not.toContain('Tenant B Goal');

    scope.set({ tenantId: 'tenant-b', profileId: 'profile-b' });
    fixture.detectChanges();
    await Promise.resolve();

    expect(fixture.nativeElement.textContent).toContain('Tenant B Goal');
    expect(fixture.nativeElement.textContent).not.toContain('Tenant A Goal');
  });
});
