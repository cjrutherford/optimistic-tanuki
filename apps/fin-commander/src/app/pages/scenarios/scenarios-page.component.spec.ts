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
  type FinCommanderScenario,
  type FinCommanderScope,
} from '@optimistic-tanuki/fin-commander-data-access';
import { ScenariosPageComponent } from './scenarios-page.component';

describe('ScenariosPageComponent', () => {
  it('reloads visible scenarios when the active tenant/profile scope changes', async () => {
    const scope = signal<FinCommanderScope | null>({
      tenantId: 'tenant-a',
      profileId: 'profile-a',
    });
    const scenariosByScope = new Map<string, FinCommanderScenario[]>([
      [
        'tenant-a.profile-a',
        [
          {
            id: 'scenario-a',
            planId: 'tenant-plan',
            name: 'Tenant A Scenario',
            summary: 'Household downside test',
            assumptions: [
              {
                id: 'assumption-a',
                label: 'Utility spike',
                delta: '+$120',
                impactArea: 'spend',
              },
            ],
          },
        ],
      ],
      [
        'tenant-b.profile-b',
        [
          {
            id: 'scenario-b',
            planId: 'tenant-plan',
            name: 'Tenant B Scenario',
            summary: 'Operating runway test',
            assumptions: [
              {
                id: 'assumption-b',
                label: 'Receivable delay',
                delta: '-$800',
                impactArea: 'income',
              },
            ],
          },
        ],
      ],
    ]);

    await TestBed.configureTestingModule({
      imports: [ScenariosPageComponent],
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
            listScenarios: (planId: string) => {
              const activeScope = scope();
              if (!activeScope || planId !== 'tenant-plan') {
                return [];
              }

              return (
                scenariosByScope.get(
                  `${activeScope.tenantId}.${activeScope.profileId}`
                ) ?? []
              );
            },
            saveScenario: jest.fn(),
            deleteScenario: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ScenariosPageComponent);
    fixture.detectChanges();
    await Promise.resolve();

    expect(fixture.nativeElement.textContent).toContain('Tenant A Scenario');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Tenant B Scenario'
    );

    scope.set({ tenantId: 'tenant-b', profileId: 'profile-b' });
    fixture.detectChanges();
    await Promise.resolve();

    expect(fixture.nativeElement.textContent).toContain('Tenant B Scenario');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Tenant A Scenario'
    );
  });
});
