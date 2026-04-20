import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';
import { FinCommanderPlanStore } from '@optimistic-tanuki/fin-commander-data-access';
import { CommanderShellComponent } from './commander-shell.component';
import { PermissionsService } from '../../permissions.service';
import { Router } from '@angular/router';

describe('CommanderShellComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommanderShellComponent],
      providers: [
        provideRouter([
          {
            path: 'commander/:planId/overview',
            component: CommanderShellComponent,
          },
        ]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ planId: 'home-command' }),
            },
            paramMap: of(convertToParamMap({ planId: 'home-command' })),
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            getScope: () => null,
            listPlans: () => [
              {
                id: 'home-command',
                name: 'Home Command',
                description: 'Primary household plan',
              },
            ],
            getPlan: () => ({
              id: 'home-command',
              name: 'Home Command',
              description: 'Primary household plan',
            }),
          },
        },
        {
          provide: PermissionsService,
          useValue: {
            can: (permission: string) =>
              permission !== 'finance.transaction.read',
          },
        },
      ],
    }).compileComponents();
  });

  it('hides shell navigation items when permission is missing', () => {
    const fixture = TestBed.createComponent(CommanderShellComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Overview');
    expect(text).not.toContain('Cash Flow');
  });

  it('uses the first scoped plan instead of assuming home-command exists', async () => {
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [CommanderShellComponent],
      providers: [
        provideRouter([
          {
            path: 'commander/:planId/overview',
            component: CommanderShellComponent,
          },
        ]),
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
                description: 'Primary tenant plan',
              },
            ],
            getPlan: () => ({
              id: 'tenant-plan',
              name: 'Tenant Plan',
              description: 'Primary tenant plan',
            }),
          },
        },
        {
          provide: PermissionsService,
          useValue: {
            can: () => true,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CommanderShellComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Tenant Plan');
    expect(fixture.nativeElement.textContent).not.toContain('Home Command');
  });

  it('refreshes the active plan when the tenant/profile scope changes', async () => {
    const scope = signal({ tenantId: 'tenant-a', profileId: 'profile-a' });

    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [CommanderShellComponent],
      providers: [
        provideRouter([
          {
            path: 'commander/:planId/overview',
            component: CommanderShellComponent,
          },
        ]),
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
                name:
                  scope().tenantId === 'tenant-a'
                    ? 'Tenant A Plan'
                    : 'Tenant B Plan',
                description: 'Primary scoped plan',
              },
            ],
            getPlan: (planId: string) => ({
              id: planId,
              name:
                planId === 'tenant-a-plan' ? 'Tenant A Plan' : 'Tenant B Plan',
              description: 'Primary scoped plan',
            }),
          },
        },
        {
          provide: PermissionsService,
          useValue: {
            can: () => true,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CommanderShellComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Tenant A Plan');

    scope.set({ tenantId: 'tenant-b', profileId: 'profile-b' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Tenant B Plan');
    expect(fixture.nativeElement.textContent).not.toContain('Tenant A Plan');
  });

  it('shows a plan empty state when no scoped plan exists for the route', async () => {
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [CommanderShellComponent],
      providers: [
        provideRouter([
          {
            path: 'commander/:planId/overview',
            component: CommanderShellComponent,
          },
        ]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ planId: 'missing-plan' }),
            },
            paramMap: of(convertToParamMap({ planId: 'missing-plan' })),
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            getScope: () => ({ tenantId: 'tenant-a', profileId: 'profile-a' }),
            listPlans: () => [],
            getPlan: () => null,
          },
        },
        {
          provide: PermissionsService,
          useValue: {
            can: () => true,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CommanderShellComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No plan yet');
    expect(fixture.nativeElement.textContent).toContain(
      'Create your first plan'
    );
  });

  it('creates a first plan from the empty state instead of sending users back to onboarding', async () => {
    TestBed.resetTestingModule();
    const savePlan = jest.fn();

    await TestBed.configureTestingModule({
      imports: [CommanderShellComponent],
      providers: [
        provideRouter([
          {
            path: 'commander/:planId/overview',
            component: CommanderShellComponent,
          },
        ]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ planId: 'new' }),
            },
            paramMap: of(convertToParamMap({ planId: 'new' })),
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            getScope: () => ({ tenantId: 'tenant-a', profileId: 'profile-a' }),
            listPlans: () => [],
            getPlan: () => null,
            savePlan,
          },
        },
        {
          provide: PermissionsService,
          useValue: {
            can: () => true,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CommanderShellComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();

    component.newPlanName = 'First Real Plan';
    await component.createPlan();

    expect(fixture.nativeElement.textContent).toContain('Plan name');
    expect(savePlan).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalled();
  });
});
