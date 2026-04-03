import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthStateService } from './auth-state.service';
import { HomeRedirectComponent } from './home-redirect.component';
import { OnboardingGateService } from './onboarding-gate.service';
import { ProfileService } from './profile.service';

describe('HomeRedirectComponent', () => {
    const routerStub = {
        navigateByUrl: jest.fn().mockResolvedValue(true),
    };
    const authStateStub = {
        isAuthenticated: true,
    };
    const profileServiceStub = {
        getAllProfiles: jest.fn().mockResolvedValue([]),
        getEffectiveProfile: jest.fn(),
        activateProfile: jest.fn().mockResolvedValue(undefined),
    };
    const onboardingGateServiceStub = {
        getState: jest.fn().mockReturnValue(
            of({
                requiresOnboarding: false,
                leadCount: 2,
                topicCount: 1,
            })
        ),
    };

    async function createComponent() {
        const fixture = TestBed.createComponent(HomeRedirectComponent);
        fixture.detectChanges();
        await fixture.whenStable();
        return fixture;
    }

    beforeEach(async () => {
        jest.clearAllMocks();
        authStateStub.isAuthenticated = true;
        profileServiceStub.getAllProfiles.mockResolvedValue([]);
        profileServiceStub.getEffectiveProfile.mockReturnValue({
            id: 'profile-1',
            appScope: 'leads-app',
        });
        profileServiceStub.activateProfile.mockResolvedValue(undefined);
        onboardingGateServiceStub.getState.mockReturnValue(
            of({
                requiresOnboarding: false,
                leadCount: 2,
                topicCount: 1,
            })
        );

        await TestBed.configureTestingModule({
            imports: [HomeRedirectComponent],
            providers: [
                {
                    provide: Router,
                    useValue: routerStub,
                },
                {
                    provide: AuthStateService,
                    useValue: authStateStub,
                },
                {
                    provide: ProfileService,
                    useValue: profileServiceStub,
                },
                {
                    provide: OnboardingGateService,
                    useValue: onboardingGateServiceStub,
                },
                {
                    provide: PLATFORM_ID,
                    useValue: 'browser',
                },
            ],
        }).compileComponents();
    });

    it('redirects unauthenticated users to login', async () => {
        authStateStub.isAuthenticated = false;

        await createComponent();

        expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/login', {
            replaceUrl: true,
        });
        expect(profileServiceStub.getAllProfiles).not.toHaveBeenCalled();
    });

    it('redirects users without a leads profile to setup', async () => {
        profileServiceStub.getEffectiveProfile.mockReturnValue(null);

        await createComponent();

        expect(profileServiceStub.getAllProfiles).toHaveBeenCalled();
        expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/profile/setup', {
            replaceUrl: true,
        });
        expect(profileServiceStub.activateProfile).not.toHaveBeenCalled();
    });

    it('redirects users with a wrong-scope profile to setup', async () => {
        profileServiceStub.getEffectiveProfile.mockReturnValue({
            id: 'profile-2',
            appScope: 'global',
        });

        await createComponent();

        expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/profile/setup', {
            replaceUrl: true,
        });
        expect(profileServiceStub.activateProfile).not.toHaveBeenCalled();
    });

    it('redirects users who still require onboarding', async () => {
        onboardingGateServiceStub.getState.mockReturnValue(
            of({
                requiresOnboarding: true,
                leadCount: 0,
                topicCount: 0,
            })
        );

        await createComponent();

        expect(profileServiceStub.activateProfile).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'profile-1' })
        );
        expect(onboardingGateServiceStub.getState).toHaveBeenCalledWith(true);
        expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/onboarding', {
            replaceUrl: true,
        });
    });

    it('redirects ready users to leads', async () => {
        await createComponent();

        expect(profileServiceStub.activateProfile).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'profile-1' })
        );
        expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/leads', {
            replaceUrl: true,
        });
    });
});
