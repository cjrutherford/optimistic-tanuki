import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import {
  BusinessApiService,
  BusinessAuthService,
} from '@optimistic-tanuki/business-data-access';

import { BusinessOwnerRegisterPageComponent } from './business-owner-register-page.component';

describe('BusinessOwnerRegisterPageComponent', () => {
  it('registers a new owner and routes first-time owners into onboarding', () => {
    const registerOwner = jest.fn().mockReturnValue(of({}));
    const loginAndExchange = jest.fn().mockReturnValue(of({}));
    const claimOwnerAccess = jest.fn().mockReturnValue(of({}));
    const getSiteConfig = jest.fn().mockReturnValue(
      of({
        configId: 'config-1',
        config: {
          site: {
            onboardingCompletedAt: '',
          },
        },
      })
    );

    TestBed.configureTestingModule({
      imports: [BusinessOwnerRegisterPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: BusinessAuthService,
          useValue: { registerOwner, loginAndExchange, claimOwnerAccess },
        },
        {
          provide: BusinessApiService,
          useValue: { getSiteConfig },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(BusinessOwnerRegisterPageComponent);
    fixture.componentInstance.fn = 'Jordan';
    fixture.componentInstance.ln = 'Vale';
    fixture.componentInstance.email = 'owner@example.com';
    fixture.componentInstance.password = 'secret';
    fixture.componentInstance.confirm = 'secret';
    fixture.componentInstance.bio = 'Running a new advisory business.';

    fixture.componentInstance.register();

    expect(registerOwner).toHaveBeenCalledWith({
      fn: 'Jordan',
      ln: 'Vale',
      email: 'owner@example.com',
      password: 'secret',
      confirm: 'secret',
      bio: 'Running a new advisory business.',
    });
    expect(loginAndExchange).toHaveBeenCalledWith(
      'owner@example.com',
      'secret'
    );
    expect(claimOwnerAccess).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/owner/onboarding']);
  });

  it('lets an existing account become an owner with the same login', () => {
    const registerOwner = jest.fn().mockReturnValue(
      throwError(() => ({
        error: { message: 'Registration failed: User already exists' },
      }))
    );
    const loginAndExchange = jest.fn().mockReturnValue(of({}));
    const claimOwnerAccess = jest.fn().mockReturnValue(of({}));
    const getSiteConfig = jest.fn().mockReturnValue(
      of({
        configId: 'config-2',
        config: {
          site: {
            onboardingCompletedAt: '2026-06-15T12:00:00.000Z',
          },
        },
      })
    );

    TestBed.configureTestingModule({
      imports: [BusinessOwnerRegisterPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: BusinessAuthService,
          useValue: { registerOwner, loginAndExchange, claimOwnerAccess },
        },
        {
          provide: BusinessApiService,
          useValue: { getSiteConfig },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(BusinessOwnerRegisterPageComponent);
    fixture.componentInstance.fn = 'Casey';
    fixture.componentInstance.ln = 'Client';
    fixture.componentInstance.email = 'client@example.com';
    fixture.componentInstance.password = 'secret';
    fixture.componentInstance.confirm = 'secret';

    fixture.componentInstance.register();

    expect(registerOwner).toHaveBeenCalled();
    expect(loginAndExchange).toHaveBeenCalledWith(
      'client@example.com',
      'secret'
    );
    expect(claimOwnerAccess).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/owner/dashboard']);
  });
});
