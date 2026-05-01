import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { TitleBarComponent } from './title-bar.component';
import { TenantContextService } from '../../tenant-context.service';
import { ProfileContext } from '../../profile.context';
import { FinCommanderPlanStore } from '@optimistic-tanuki/fin-commander-data-access';
import { FinanceService } from '@optimistic-tanuki/finance-ui';

describe('TitleBarComponent', () => {
  it('shows public navigation and hides signed-in controls when unauthenticated', async () => {
    await TestBed.configureTestingModule({
      imports: [TitleBarComponent],
      providers: [
        provideRouter([]),
        {
          provide: TenantContextService,
          useValue: {
            activeTenant: signal(null),
            activeTenantId: signal(null),
            availableTenants: signal([]),
            selectTenant: jest.fn(),
          },
        },
        {
          provide: ProfileContext,
          useValue: {
            isAuthenticated: signal(false),
            currentProfile: signal(null),
            currentProfiles: signal([]),
            profileName: signal('Select profile'),
            selectProfile: jest.fn(),
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            listPlans: () => [],
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              availableWorkspaces: [],
              checklist: [],
              requiresOnboarding: false,
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TitleBarComponent);
    fixture.detectChanges();

    expect(
      fixture.componentInstance.navItems().map((item) => item.label)
    ).toEqual(['Home', 'Register', 'Login']);
    expect(fixture.nativeElement.textContent).not.toContain('Active tenant');
    expect(fixture.nativeElement.textContent).not.toContain('Profile');
  });

  it('shows active tenant and plan in production navigation state', async () => {
    await TestBed.configureTestingModule({
      imports: [TitleBarComponent],
      providers: [
        provideRouter([]),
        {
          provide: TenantContextService,
          useValue: {
            activeTenant: signal({
              id: 'tenant-1',
              name: 'North Household',
              type: 'household',
            }),
            activeTenantId: signal('tenant-1'),
            availableTenants: signal([
              { id: 'tenant-1', name: 'North Household' },
            ]),
            selectTenant: jest.fn(),
          },
        },
        {
          provide: ProfileContext,
          useValue: {
            isAuthenticated: signal(true),
            currentProfile: signal({
              id: 'profile-1',
              profileName: 'Finance Captain',
            }),
            currentProfiles: signal([
              { id: 'profile-1', profileName: 'Finance Captain' },
            ]),
            profileName: signal('Finance Captain'),
            selectProfile: jest.fn(),
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            getScope: () => ({ tenantId: 'tenant-1', profileId: 'profile-1' }),
            listPlans: () => [
              {
                id: 'tenant-plan',
                name: 'North Household Plan',
                description: 'Primary operating plan',
                defaultWorkspace: 'personal',
                updatedAt: '2026-04-13',
              },
            ],
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              availableWorkspaces: ['personal', 'business', 'net-worth'],
              checklist: [],
              requiresOnboarding: false,
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TitleBarComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('North Household');
    expect(fixture.nativeElement.textContent).toContain('North Household Plan');
    expect(fixture.nativeElement.textContent).not.toContain('home-command');
  });

  it('keeps finance navigation available for authenticated users without a loaded plan', async () => {
    await TestBed.configureTestingModule({
      imports: [TitleBarComponent],
      providers: [
        provideRouter([]),
        {
          provide: TenantContextService,
          useValue: {
            activeTenant: signal({
              id: 'tenant-1',
              name: 'North Household',
              type: 'household',
            }),
            activeTenantId: signal('tenant-1'),
            availableTenants: signal([
              { id: 'tenant-1', name: 'North Household' },
            ]),
            selectTenant: jest.fn(),
          },
        },
        {
          provide: ProfileContext,
          useValue: {
            isAuthenticated: signal(true),
            currentProfile: signal({
              id: 'profile-1',
              profileName: 'Finance Captain',
            }),
            currentProfiles: signal([
              { id: 'profile-1', profileName: 'Finance Captain' },
            ]),
            profileName: signal('Finance Captain'),
            selectProfile: jest.fn(),
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            listPlans: () => [],
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              availableWorkspaces: ['personal'],
              checklist: [],
              requiresOnboarding: false,
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TitleBarComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.componentInstance.navItems().map((item) => item.label)
    ).toEqual(['Ledger', 'Commander', 'Settings']);
  });

  it('shows only onboarded finance workspaces in signed-in navigation', async () => {
    await TestBed.configureTestingModule({
      imports: [TitleBarComponent],
      providers: [
        provideRouter([]),
        {
          provide: TenantContextService,
          useValue: {
            activeTenant: signal({
              id: 'tenant-1',
              name: 'North Household',
              type: 'household',
            }),
            activeTenantId: signal('tenant-1'),
            availableTenants: signal([
              { id: 'tenant-1', name: 'North Household' },
            ]),
            selectTenant: jest.fn(),
          },
        },
        {
          provide: ProfileContext,
          useValue: {
            isAuthenticated: signal(true),
            currentProfile: signal({
              id: 'profile-1',
              profileName: 'Finance Captain',
            }),
            currentProfiles: signal([
              { id: 'profile-1', profileName: 'Finance Captain' },
            ]),
            profileName: signal('Finance Captain'),
            selectProfile: jest.fn(),
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            listPlans: () => [],
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              availableWorkspaces: ['personal', 'net-worth'],
              checklist: [],
              requiresOnboarding: false,
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TitleBarComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.componentInstance.navItems().map((item) => item.label)
    ).toEqual(['Ledger', 'Commander', 'Settings']);
  });

  it('navigates using the first scoped plan instead of home-command defaults', async () => {
    await TestBed.configureTestingModule({
      imports: [TitleBarComponent],
      providers: [
        provideRouter([]),
        {
          provide: TenantContextService,
          useValue: {
            activeTenant: signal({
              id: 'tenant-1',
              name: 'North Household',
              type: 'household',
            }),
            activeTenantId: signal('tenant-1'),
            availableTenants: signal([
              { id: 'tenant-1', name: 'North Household' },
            ]),
            selectTenant: jest.fn(),
          },
        },
        {
          provide: ProfileContext,
          useValue: {
            isAuthenticated: signal(true),
            currentProfile: signal({
              id: 'profile-1',
              profileName: 'Finance Captain',
            }),
            currentProfiles: signal([
              { id: 'profile-1', profileName: 'Finance Captain' },
            ]),
            profileName: signal('Finance Captain'),
            selectProfile: jest.fn(),
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            getScope: () => ({ tenantId: 'tenant-1', profileId: 'profile-1' }),
            listPlans: () => [
              {
                id: 'tenant-plan',
                name: 'North Household Plan',
                description: 'Primary operating plan',
                defaultWorkspace: 'personal',
                updatedAt: '2026-04-13',
              },
            ],
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              availableWorkspaces: ['personal'],
              checklist: [],
              requiresOnboarding: false,
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TitleBarComponent);
    const router = TestBed.inject(Router);
    const navigateByUrl = jest
      .spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);

    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance
      .navItems()
      .find((item) => item.label === 'Commander')
      ?.action?.();

    expect(navigateByUrl).toHaveBeenCalledWith(
      '/commander/tenant-plan/overview'
    );
    expect(navigateByUrl).not.toHaveBeenCalledWith(
      '/commander/home-command/overview'
    );
  });

  it('routes the top-level commander destination to the new plan flow when no plan exists', async () => {
    await TestBed.configureTestingModule({
      imports: [TitleBarComponent],
      providers: [
        provideRouter([]),
        {
          provide: TenantContextService,
          useValue: {
            activeTenant: signal({ id: 'tenant-1', name: 'North Household' }),
            activeTenantId: signal('tenant-1'),
            availableTenants: signal([
              { id: 'tenant-1', name: 'North Household' },
            ]),
            selectTenant: jest.fn(),
          },
        },
        {
          provide: ProfileContext,
          useValue: {
            isAuthenticated: signal(true),
            currentProfile: signal({
              id: 'profile-1',
              profileName: 'Finance Captain',
            }),
            currentProfiles: signal([
              { id: 'profile-1', profileName: 'Finance Captain' },
            ]),
            profileName: signal('Finance Captain'),
            selectProfile: jest.fn(),
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            listPlans: () => [],
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              availableWorkspaces: ['personal'],
              checklist: [
                { id: 'accounts', label: 'Add account', complete: true },
              ],
              requiresOnboarding: false,
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TitleBarComponent);
    const router = TestBed.inject(Router);
    const navigateByUrl = jest
      .spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);

    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance
      .navItems()
      .find((item) => item.label === 'Commander')
      ?.action?.();

    expect(navigateByUrl).toHaveBeenCalledWith('/commander/new/overview');
  });

  it('uses the active commander route plan instead of the first stored plan', async () => {
    await TestBed.configureTestingModule({
      imports: [TitleBarComponent],
      providers: [
        provideRouter([]),
        {
          provide: TenantContextService,
          useValue: {
            activeTenant: signal({ id: 'tenant-1', name: 'North Household' }),
            activeTenantId: signal('tenant-1'),
            availableTenants: signal([
              { id: 'tenant-1', name: 'North Household' },
            ]),
            selectTenant: jest.fn(),
          },
        },
        {
          provide: ProfileContext,
          useValue: {
            isAuthenticated: signal(true),
            currentProfile: signal({
              id: 'profile-1',
              profileName: 'Finance Captain',
            }),
            currentProfiles: signal([
              { id: 'profile-1', profileName: 'Finance Captain' },
            ]),
            profileName: signal('Finance Captain'),
            selectProfile: jest.fn(),
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            getScope: () => ({ tenantId: 'tenant-1', profileId: 'profile-1' }),
            listPlans: () => [
              {
                id: 'first-plan',
                name: 'First Plan',
                description: 'First stored plan',
                defaultWorkspace: 'personal',
                updatedAt: '2026-04-13',
              },
              {
                id: 'route-plan',
                name: 'Route Plan',
                description: 'Plan from current route',
                defaultWorkspace: 'business',
                updatedAt: '2026-04-13',
              },
            ],
            getPlan: (planId: string) =>
              [
                {
                  id: 'first-plan',
                  name: 'First Plan',
                  description: 'First stored plan',
                  defaultWorkspace: 'personal',
                  updatedAt: '2026-04-13',
                },
                {
                  id: 'route-plan',
                  name: 'Route Plan',
                  description: 'Plan from current route',
                  defaultWorkspace: 'business',
                  updatedAt: '2026-04-13',
                },
              ].find((plan) => plan.id === planId) ?? null,
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              availableWorkspaces: ['personal'],
              checklist: [],
              requiresOnboarding: false,
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TitleBarComponent);
    const router = TestBed.inject(Router);
    Object.defineProperty(router, 'url', {
      configurable: true,
      get: () => '/commander/route-plan/overview',
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Route Plan');
    expect(fixture.nativeElement.textContent).not.toContain('First Plan');
    expect(
      fixture.componentInstance
        .navItems()
        .find((item) => item.label === 'Commander')
    ).toBeDefined();
  });

  it('reduces signed-in navigation to top-level destinations', async () => {
    await TestBed.configureTestingModule({
      imports: [TitleBarComponent],
      providers: [
        provideRouter([]),
        {
          provide: TenantContextService,
          useValue: {
            activeTenant: signal({ id: 'tenant-1', name: 'North Household' }),
            activeTenantId: signal('tenant-1'),
            availableTenants: signal([
              { id: 'tenant-1', name: 'North Household' },
            ]),
            selectTenant: jest.fn(),
          },
        },
        {
          provide: ProfileContext,
          useValue: {
            isAuthenticated: signal(true),
            currentProfile: signal({
              id: 'profile-1',
              profileName: 'Finance Captain',
            }),
            currentProfiles: signal([
              { id: 'profile-1', profileName: 'Finance Captain' },
            ]),
            profileName: signal('Finance Captain'),
            selectProfile: jest.fn(),
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            listPlans: () => [
              {
                id: 'tenant-plan',
                name: 'North Household Plan',
                description: 'Primary operating plan',
                defaultWorkspace: 'personal',
                updatedAt: '2026-04-13',
              },
            ],
            getPlan: () => ({
              id: 'tenant-plan',
              name: 'North Household Plan',
              description: 'Primary operating plan',
              defaultWorkspace: 'personal',
              updatedAt: '2026-04-13',
            }),
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              availableWorkspaces: ['personal', 'business', 'net-worth'],
              checklist: [
                { id: 'accounts', label: 'Add account', complete: true },
              ],
              requiresOnboarding: false,
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TitleBarComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      fixture.componentInstance.navItems().map((item) => item.label)
    ).toEqual(['Ledger', 'Commander', 'Settings']);
    expect(fixture.nativeElement.textContent).not.toContain('Cash Flow');
    expect(fixture.nativeElement.textContent).not.toContain('Goals');
    expect(fixture.nativeElement.textContent).not.toContain('Scenarios');
    expect(fixture.nativeElement.textContent).not.toContain('Imports');
  });

  it('shows the next setup action in the help panel instead of static help links', async () => {
    await TestBed.configureTestingModule({
      imports: [TitleBarComponent],
      providers: [
        provideRouter([]),
        {
          provide: TenantContextService,
          useValue: {
            activeTenant: signal({
              id: 'tenant-1',
              name: 'North Household',
              type: 'household',
            }),
            activeTenantId: signal('tenant-1'),
            availableTenants: signal([
              { id: 'tenant-1', name: 'North Household' },
            ]),
            selectTenant: jest.fn(),
          },
        },
        {
          provide: ProfileContext,
          useValue: {
            isAuthenticated: signal(true),
            currentProfile: signal({
              id: 'profile-1',
              profileName: 'Finance Captain',
            }),
            currentProfiles: signal([
              { id: 'profile-1', profileName: 'Finance Captain' },
            ]),
            profileName: signal('Finance Captain'),
            selectProfile: jest.fn(),
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            listPlans: () => [],
            getPlan: () => null,
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue({
              availableWorkspaces: ['personal'],
              checklist: [
                {
                  id: 'create-budget',
                  label: 'Create budget',
                  complete: false,
                },
              ],
              requiresOnboarding: false,
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TitleBarComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.toggleHelp();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('What to do next');
    expect(fixture.nativeElement.textContent).toContain(
      'Finish setup checklist'
    );
    expect(fixture.nativeElement.textContent).not.toContain('Help & Guide');
    expect(fixture.nativeElement.textContent).not.toContain('Personal Ledger');
    expect(fixture.nativeElement.textContent).not.toContain('Business Ledger');
  });
});
