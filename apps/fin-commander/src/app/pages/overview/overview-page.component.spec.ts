import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';
import {
  FinCommanderOverview,
  FinCommanderPlanStore,
} from '@optimistic-tanuki/fin-commander-data-access';
import { OverviewPageComponent } from './overview-page.component';

describe('OverviewPageComponent', () => {
  it('uses the first scoped plan when the route does not provide a hardcoded home-command id', async () => {
    const buildOverview = jest.fn().mockResolvedValue({
      plan: {
        id: 'tenant-plan',
        name: 'Tenant Plan',
        description: 'Scoped plan',
        defaultWorkspace: 'personal',
        updatedAt: '2026-04-13',
      },
      goals: [],
      scenarios: [],
      workspaces: [],
    } satisfies FinCommanderOverview);

    await TestBed.configureTestingModule({
      imports: [OverviewPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({}) },
            paramMap: of(convertToParamMap({})),
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            getScope: () => null,
            listPlans: () => [
              {
                id: 'tenant-plan',
                name: 'Tenant Plan',
                description: 'Scoped plan',
                defaultWorkspace: 'personal',
                updatedAt: '2026-04-13',
              },
            ],
            buildOverview,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OverviewPageComponent);
    fixture.detectChanges();
    await Promise.resolve();

    expect(buildOverview).toHaveBeenCalledWith('tenant-plan');
  });

  it('rebuilds the overview when the active tenant/profile scope changes', async () => {
    const scope = signal({ tenantId: 'tenant-a', profileId: 'profile-a' });
    const buildOverview = jest.fn().mockImplementation(
      async (planId: string) =>
        ({
          plan: {
            id: planId,
            name:
              planId === 'tenant-a-plan' ? 'Tenant A Plan' : 'Tenant B Plan',
            description: 'Scoped plan',
            defaultWorkspace: 'personal',
            updatedAt: '2026-04-13',
          },
          goals: [],
          scenarios: [],
          workspaces: [],
        } satisfies FinCommanderOverview)
    );

    await TestBed.configureTestingModule({
      imports: [OverviewPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({}) },
            paramMap: of(convertToParamMap({})),
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            getScope: () => scope(),
            listPlans: () => [
              {
                id:
                  scope().tenantId === 'tenant-a'
                    ? 'tenant-a-plan'
                    : 'tenant-b-plan',
                name: 'Scoped Plan',
                description: 'Scoped plan',
                defaultWorkspace: 'personal',
                updatedAt: '2026-04-13',
              },
            ],
            buildOverview,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OverviewPageComponent);
    fixture.detectChanges();
    await Promise.resolve();

    scope.set({ tenantId: 'tenant-b', profileId: 'profile-b' });
    fixture.detectChanges();
    await Promise.resolve();

    expect(buildOverview).toHaveBeenNthCalledWith(1, 'tenant-a-plan');
    expect(buildOverview).toHaveBeenNthCalledWith(2, 'tenant-b-plan');
  });

  it('shows a true empty state when no plan exists for the current scope', async () => {
    await TestBed.configureTestingModule({
      imports: [OverviewPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({}) },
            paramMap: of(convertToParamMap({})),
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            getScope: () => ({ tenantId: 'tenant-a', profileId: 'profile-a' }),
            listPlans: () => [],
            buildOverview: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OverviewPageComponent);
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No plan yet');
    expect(fixture.nativeElement.textContent).toContain(
      'Create your first plan'
    );
  });
});
