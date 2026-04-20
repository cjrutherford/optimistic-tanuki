import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { FinanceService } from '@optimistic-tanuki/finance-ui';
import { SettingsComponent } from './settings.component';
import { ProfileService } from '../profile.service';
import { AuthStateService } from '../state/auth-state.service';
import { TenantContextService } from '../tenant-context.service';

describe('SettingsComponent', () => {
  const profileService = {
    getCurrentUserProfile: jest.fn(),
    getEffectiveProfile: jest.fn(),
    createProfile: jest.fn().mockResolvedValue(undefined),
    updateProfile: jest.fn().mockResolvedValue(undefined),
    getAllProfiles: jest.fn().mockResolvedValue(undefined),
    getProfileById: jest.fn().mockResolvedValue(undefined),
  };
  const router = {
    navigate: jest.fn().mockResolvedValue(true),
  };
  const tenantContext = {
    loadTenantContext: jest.fn().mockResolvedValue(undefined),
    activeTenant: jest.fn().mockReturnValue(null),
  };
  const financeService = {
    getOnboardingState: jest.fn().mockResolvedValue({
      requiresOnboarding: true,
      availableWorkspaces: [],
      checklist: [],
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    profileService.getCurrentUserProfile.mockReturnValue(null);
    profileService.getEffectiveProfile.mockReturnValue(null);

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: ProfileService, useValue: profileService },
        {
          provide: AuthStateService,
          useValue: {
            getDecodedTokenValue: () => ({ name: 'Fin Commander' }),
          },
        },
        { provide: Router, useValue: router },
        { provide: TenantContextService, useValue: tenantContext },
        { provide: FinanceService, useValue: financeService },
      ],
    }).compileComponents();
  });

  it('keeps the profile editor mounted so it can open from settings actions', async () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('lib-profile-editor')
    ).not.toBeNull();

    fixture.componentInstance.openProfileEditor();
    fixture.detectChanges();

    expect(fixture.componentInstance.showProfileEditor).toBe(true);
  });

  it('hands a newly created profile off to onboarding when no account exists yet', async () => {
    profileService.getCurrentUserProfile.mockReturnValue({ id: 'profile-1' });
    profileService.getEffectiveProfile.mockReturnValue({ id: 'profile-1' });

    const fixture = TestBed.createComponent(SettingsComponent);

    await fixture.componentInstance.onCreateProfile({ profileName: 'Captain' });

    expect(router.navigate).toHaveBeenCalledWith(['/onboarding']);
  });
});
