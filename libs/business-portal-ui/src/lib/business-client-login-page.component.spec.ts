import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';

import { BusinessAuthService } from '@optimistic-tanuki/business-data-access';

import { BusinessClientLoginPageComponent } from './business-client-login-page.component';
import { EmailAuthClientService } from '@optimistic-tanuki/auth-ui';

describe('BusinessClientLoginPageComponent', () => {
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
