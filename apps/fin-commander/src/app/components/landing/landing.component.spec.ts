import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { LandingComponent } from './landing.component';
import { ProfileContext } from '../../profile.context';
import { TenantContextService } from '../../tenant-context.service';
import { FinanceService } from '@optimistic-tanuki/finance-ui';
import { FinCommanderPlanStore } from '@optimistic-tanuki/fin-commander-data-access';

describe('LandingComponent', () => {
  const createComponent = async (
    isAuthenticated: boolean,
    options?: {
      activeTenant?: { id: string; name: string } | null;
      onboardingState?: {
        requiresOnboarding: boolean;
        availableWorkspaces: Array<'personal' | 'business' | 'net-worth'>;
        checklist: Array<{ id: string; label: string; complete: boolean }>;
      };
      plans?: Array<{
        id: string;
        name: string;
        description: string;
        defaultWorkspace: 'personal' | 'business' | 'net-worth';
        updatedAt: string;
      }>;
      currentProfile?: { id: string; profileName: string } | null;
    }
  ): Promise<ComponentFixture<LandingComponent>> => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        provideRouter([]),
        {
          provide: ProfileContext,
          useValue: {
            isAuthenticated: signal(isAuthenticated),
            currentProfile: signal(options?.currentProfile ?? null),
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            activeTenant: signal(options?.activeTenant ?? null),
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getOnboardingState: jest.fn().mockResolvedValue(
              options?.onboardingState ?? {
                requiresOnboarding: false,
                availableWorkspaces: ['personal'],
                checklist: [],
              }
            ),
          },
        },
        {
          provide: FinCommanderPlanStore,
          useValue: {
            listPlans: () => options?.plans ?? [],
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('creates the component', async () => {
    const fixture = await createComponent(false);
    const component = fixture.componentInstance;

    expect(component).toBeTruthy();
  });

  it('shows registration and login actions for signed-out visitors', async () => {
    const fixture = await createComponent(false);

    expect(fixture.nativeElement.textContent).toContain('Get Started');
    expect(fixture.nativeElement.textContent).toContain('Sign In');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Open Command Workspace'
    );
  });

  it('uses production positioning instead of proof-of-concept language', async () => {
    const fixture = await createComponent(false);

    expect(fixture.nativeElement.textContent).not.toContain('proof-of-concept');
    expect(fixture.nativeElement.textContent).not.toContain('single-user');
    expect(fixture.nativeElement.textContent).not.toContain('tenant-aware');
    expect(fixture.nativeElement.textContent).not.toContain(
      'runtime provider registry'
    );
  });

  it('shows application entry actions for authenticated users', async () => {
    const fixture = await createComponent(true, {
      currentProfile: { id: 'profile-1', profileName: 'Finance Captain' },
      activeTenant: { id: 'tenant-1', name: 'North Household' },
      onboardingState: {
        requiresOnboarding: false,
        availableWorkspaces: ['personal'],
        checklist: [{ id: 'accounts', label: 'Add account', complete: true }],
      },
      plans: [
        {
          id: 'tenant-plan',
          name: 'North Household Plan',
          description: 'Primary operating plan',
          defaultWorkspace: 'personal',
          updatedAt: '2026-04-13',
        },
      ],
    });

    expect(fixture.nativeElement.textContent).toContain('Open your plan');
    expect(fixture.nativeElement.textContent).toContain('Review your ledger');
    expect(fixture.nativeElement.textContent).not.toContain('Register');
  });

  it('sends authenticated users to the true next setup step', async () => {
    const fixture = await createComponent(true, {
      currentProfile: { id: 'profile-1', profileName: 'Finance Captain' },
      activeTenant: { id: 'tenant-1', name: 'North Household' },
      onboardingState: {
        requiresOnboarding: false,
        availableWorkspaces: ['personal'],
        checklist: [
          { id: 'create-budget', label: 'Create budget', complete: false },
        ],
      },
    });

    expect(fixture.nativeElement.textContent).toContain('Finish setup');
    expect(fixture.nativeElement.textContent).not.toContain('home-command');
  });
});
