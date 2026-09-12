import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, Subject } from 'rxjs';

import { BusinessAuthService } from '@optimistic-tanuki/business-data-access';

import { BusinessClientLoginPageComponent } from './business-client-login-page.component';
import { EmailAuthClientService } from '@optimistic-tanuki/auth-ui';

describe('BusinessClientLoginPageComponent', () => {
  it('waits for the cookie client session, then restores a safe return URL', () => {
    const loginResult = new Subject<unknown>();
    const loginClient = jest.fn().mockReturnValue(loginResult);
    const navigate = jest.fn();
    const navigateByUrl = jest.fn();

    TestBed.configureTestingModule({
      imports: [BusinessClientLoginPageComponent],
      providers: [
        {
          provide: EmailAuthClientService,
          useValue: { request: jest.fn() },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                siteSlug: 'steady-hand-contracting',
              }),
              queryParamMap: convertToParamMap({
                returnUrl:
                  '/sites/steady-hand-contracting/client/routines?view=week',
              }),
            },
            paramMap: of(
              convertToParamMap({ siteSlug: 'steady-hand-contracting' })
            ),
          },
        },
        {
          provide: BusinessAuthService,
          useValue: { loginClient },
        },
        {
          provide: Router,
          useValue: { navigate, navigateByUrl },
        },
      ],
    });

    const fixture = TestBed.createComponent(BusinessClientLoginPageComponent);
    fixture.componentInstance.email = 'client@example.com';
    fixture.componentInstance.password = 'secret';

    fixture.componentInstance.login();

    expect(navigate).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();

    loginResult.next({});
    loginResult.complete();

    expect(navigateByUrl).toHaveBeenCalledWith(
      '/sites/steady-hand-contracting/client/routines?view=week'
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    'https://evil.example/client/dashboard',
    '//evil.example/client/dashboard',
    '/sites/steady-hand-contracting/client/login',
    '/sites/steady-hand-contracting/client/register',
    '/sites/steady-hand-contracting/client/dashboard\nalert(1)',
  ])(
    'uses the hosted client dashboard fallback for unsafe return URL %s',
    (returnUrl) => {
      const loginClient = jest.fn().mockReturnValue(of({}));
      const navigate = jest.fn();
      const navigateByUrl = jest.fn();

      TestBed.configureTestingModule({
        imports: [BusinessClientLoginPageComponent],
        providers: [
          {
            provide: EmailAuthClientService,
            useValue: { request: jest.fn() },
          },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                paramMap: convertToParamMap({
                  siteSlug: 'steady-hand-contracting',
                }),
                queryParamMap: convertToParamMap({ returnUrl }),
              },
              paramMap: of(
                convertToParamMap({ siteSlug: 'steady-hand-contracting' })
              ),
            },
          },
          {
            provide: BusinessAuthService,
            useValue: { loginClient },
          },
          {
            provide: Router,
            useValue: { navigate, navigateByUrl },
          },
        ],
      });

      const fixture = TestBed.createComponent(BusinessClientLoginPageComponent);
      fixture.componentInstance.email = 'client@example.com';
      fixture.componentInstance.password = 'secret';

      fixture.componentInstance.login();

      expect(navigateByUrl).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith([
        '/sites',
        'steady-hand-contracting',
        'client',
        'dashboard',
      ]);
    }
  );

  it('routes a hosted business client to the matching hosted dashboard after login', () => {
    const navigate = jest.fn();
    const loginClient = jest.fn().mockReturnValue(of({}));

    TestBed.configureTestingModule({
      imports: [BusinessClientLoginPageComponent],
      providers: [
        {
          provide: EmailAuthClientService,
          useValue: { request: jest.fn() },
        },
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
          useValue: { loginClient },
        },
        {
          provide: Router,
          useValue: { navigate },
        },
      ],
    });

    const fixture = TestBed.createComponent(BusinessClientLoginPageComponent);
    fixture.componentInstance.email = 'client@example.com';
    fixture.componentInstance.password = 'secret';

    fixture.componentInstance.login();

    expect(loginClient).toHaveBeenCalledWith('client@example.com', 'secret');
    expect(navigate).toHaveBeenCalledWith([
      '/sites',
      'steady-hand-contracting',
      'client',
      'dashboard',
    ]);
  });
});
