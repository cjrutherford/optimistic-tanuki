import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LoginBlockComponent } from '@optimistic-tanuki/auth-ui';
import { FinanceService } from '@optimistic-tanuki/finance-ui';
import { LoginComponent } from './login.component';
import { ProfileService } from '../profile.service';
import { AuthStateService } from '../state/auth-state.service';
import { TenantContextService } from '../tenant-context.service';

@Component({
  selector: 'lib-login-block',
  standalone: true,
  template: '',
})
class StubLoginBlockComponent {}

describe('LoginComponent', () => {
  const profileService = {
    getAllProfiles: jest.fn().mockResolvedValue(undefined),
    getCurrentUserProfile: jest.fn(),
    getEffectiveProfile: jest.fn(),
    selectProfile: jest.fn(),
  };
  const tenantContext = {
    loadTenantContext: jest.fn().mockResolvedValue(undefined),
    activeTenant: jest.fn(),
  };
  const financeService = {
    getOnboardingState: jest.fn(),
  };
  const router = {
    navigate: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    TestBed.overrideComponent(LoginComponent, {
      remove: {
        imports: [LoginBlockComponent],
      },
      add: {
        imports: [StubLoginBlockComponent],
      },
    });

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        {
          provide: AuthStateService,
          useValue: {
            login: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: ProfileService, useValue: profileService },
        { provide: TenantContextService, useValue: tenantContext },
        { provide: FinanceService, useValue: financeService },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
  });

  it('routes users without a finance profile to settings after login', async () => {
    const fixture = TestBed.createComponent(LoginComponent);

    profileService.getCurrentUserProfile.mockReturnValue(null);
    profileService.getEffectiveProfile.mockReturnValue(null);

    await fixture.componentInstance.onSubmit({
      email: 'captain@example.com',
      password: 'secret',
    });

    expect(router.navigate).toHaveBeenCalledWith(['/settings']);
  });

  it('normalizes the submitted email before logging in', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const authStateService = TestBed.inject(AuthStateService) as unknown as {
      login: jest.Mock;
    };

    profileService.getCurrentUserProfile.mockReturnValue(null);
    profileService.getEffectiveProfile.mockReturnValue(null);

    await fixture.componentInstance.onSubmit({
      email: 'Captain@Example.COM',
      password: 'secret',
    });

    expect(authStateService.login).toHaveBeenCalledWith({
      email: 'captain@example.com',
      password: 'secret',
    });
  });

  it('routes users with a profile but no active tenant to onboarding', async () => {
    const fixture = TestBed.createComponent(LoginComponent);

    profileService.getCurrentUserProfile.mockReturnValue({ id: 'profile-1' });
    profileService.getEffectiveProfile.mockReturnValue({ id: 'profile-1' });
    tenantContext.activeTenant.mockReturnValue(null);

    await fixture.componentInstance.onSubmit({
      email: 'captain@example.com',
      password: 'secret',
    });

    expect(router.navigate).toHaveBeenCalledWith(['/onboarding']);
  });

  it('still routes users to onboarding when tenant context hydration fails after login', async () => {
    const fixture = TestBed.createComponent(LoginComponent);

    profileService.getCurrentUserProfile.mockReturnValue({ id: 'profile-1' });
    profileService.getEffectiveProfile.mockReturnValue({ id: 'profile-1' });
    tenantContext.loadTenantContext.mockRejectedValueOnce(
      new Error('Active finance tenant not found')
    );
    tenantContext.activeTenant.mockReturnValue(null);

    await expect(
      fixture.componentInstance.onSubmit({
        email: 'captain@example.com',
        password: 'secret',
      })
    ).resolves.toBeUndefined();

    expect(router.navigate).toHaveBeenCalledWith(['/onboarding']);
  });

  it('routes users with incomplete finance setup back into onboarding', async () => {
    const fixture = TestBed.createComponent(LoginComponent);

    profileService.getCurrentUserProfile.mockReturnValue({ id: 'profile-1' });
    profileService.getEffectiveProfile.mockReturnValue({ id: 'profile-1' });
    tenantContext.activeTenant.mockReturnValue({
      id: 'tenant-1',
      type: 'household',
    });
    financeService.getOnboardingState.mockResolvedValue({
      requiresOnboarding: false,
      availableWorkspaces: ['personal'],
      checklist: [{ id: 'create-budget', complete: false }],
    });

    await fixture.componentInstance.onSubmit({
      email: 'captain@example.com',
      password: 'secret',
    });

    expect(router.navigate).toHaveBeenCalledWith(['/onboarding']);
  });

  it('routes fully set up users to finance landing', async () => {
    const fixture = TestBed.createComponent(LoginComponent);

    profileService.getCurrentUserProfile.mockReturnValue({ id: 'profile-1' });
    profileService.getEffectiveProfile.mockReturnValue({ id: 'profile-1' });
    tenantContext.activeTenant.mockReturnValue({
      id: 'tenant-1',
      type: 'household',
    });
    financeService.getOnboardingState.mockResolvedValue({
      requiresOnboarding: false,
      availableWorkspaces: ['personal'],
      checklist: [{ id: 'create-budget', complete: true }],
    });

    await fixture.componentInstance.onSubmit({
      email: 'captain@example.com',
      password: 'secret',
    });

    expect(router.navigate).toHaveBeenCalledWith(['/finance']);
  });
});
