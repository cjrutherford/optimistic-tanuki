import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';

import {
  BusinessApiService,
  BusinessAuthService,
} from '@optimistic-tanuki/business-data-access';

import { BusinessClientRegisterPageComponent } from './business-client-register-page.component';

describe('BusinessClientRegisterPageComponent', () => {
  it('keeps the hosted business slug in the sign-in link', () => {
    TestBed.configureTestingModule({
      imports: [BusinessClientRegisterPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                siteSlug: 'steady-hand-contracting',
              }),
            },
            paramMap: of(
              convertToParamMap({ siteSlug: 'steady-hand-contracting' })
            ),
          },
        },
        {
          provide: BusinessAuthService,
          useValue: { registerClient: jest.fn().mockReturnValue(of({})) },
        },
        {
          provide: BusinessApiService,
          useValue: { createLeadIntake: jest.fn().mockReturnValue(of({})) },
        },
      ],
    });

    const fixture = TestBed.createComponent(
      BusinessClientRegisterPageComponent
    );
    fixture.detectChanges();

    const links = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink));

    expect(links.map((link) => link.href)).toContain(
      '/sites/steady-hand-contracting/client/login'
    );
  });

  it('routes a hosted business client to the client dashboard after registration', () => {
    const navigate = jest.fn();
    const registerClient = jest.fn().mockReturnValue(of({}));
    const loginClient = jest.fn().mockReturnValue(
      of({
        userId: 'client-user-1',
        email: 'client@example.com',
      })
    );
    const createLeadIntake = jest.fn().mockReturnValue(of({ id: 'lead-1' }));

    TestBed.configureTestingModule({
      imports: [BusinessClientRegisterPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                siteSlug: 'steady-hand-contracting',
              }),
            },
            paramMap: of(
              convertToParamMap({ siteSlug: 'steady-hand-contracting' })
            ),
          },
        },
        {
          provide: BusinessAuthService,
          useValue: { registerClient, loginClient },
        },
        {
          provide: BusinessApiService,
          useValue: { createLeadIntake },
        },
        {
          provide: Router,
          useValue: { navigate },
        },
      ],
    });

    const fixture = TestBed.createComponent(
      BusinessClientRegisterPageComponent
    );
    fixture.componentInstance.fn = 'Taylor';
    fixture.componentInstance.ln = 'Client';
    fixture.componentInstance.email = 'client@example.com';
    fixture.componentInstance.password = 'secret';
    fixture.componentInstance.confirm = 'secret';
    fixture.componentInstance.bio = 'Looking for a quote';

    fixture.componentInstance.register();

    expect(createLeadIntake).toHaveBeenCalledWith(
      expect.objectContaining({
        siteSlug: 'steady-hand-contracting',
        email: 'client@example.com',
        name: 'Taylor Client',
        goal: 'Looking for a quote',
      })
    );
    expect(navigate).toHaveBeenCalledWith([
      '/sites',
      'steady-hand-contracting',
      'client',
      'dashboard',
    ]);
  });
});
