import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';

import {
  BusinessApiService,
  BusinessAuthService,
} from '@optimistic-tanuki/business-data-access';

import { BusinessLoginPageComponent } from './business-login-page.component';
import { RouterLink } from '@angular/router';
import { EmailAuthClientService } from '@optimistic-tanuki/auth-ui';

const emailAuthProvider = {
  provide: EmailAuthClientService,
  useValue: { request: jest.fn() },
};

describe('BusinessLoginPageComponent', () => {
  it('routes a completed owner to the owner dashboard after login', () => {
    const loginAndExchange = jest.fn().mockReturnValue(of({}));
    const getSiteConfig = jest.fn().mockReturnValue(
      of({
        configId: 'config-1',
        config: {
          site: {
            onboardingCompletedAt: '2026-06-13T10:00:00.000Z',
          },
        },
      })
    );

    TestBed.configureTestingModule({
      imports: [BusinessLoginPageComponent],
      providers: [
        emailAuthProvider,
        provideRouter([]),
        {
          provide: BusinessAuthService,
          useValue: { loginAndExchange },
        },
        {
          provide: BusinessApiService,
          useValue: { getSiteConfig },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(BusinessLoginPageComponent);
    fixture.componentInstance.email = 'owner@example.com';
    fixture.componentInstance.password = 'secret';
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Owner Login');
    expect(text).toContain('owner workspace');
    expect(text).not.toContain('Trainer Login');
    expect(fixture.nativeElement.textContent).not.toContain(
      'trainer workspace'
    );
    expect(
      fixture.nativeElement.querySelector('input[type="email"]').placeholder
    ).toBe('owner@example.com');

    fixture.componentInstance.onSubmit();

    expect(loginAndExchange).toHaveBeenCalledWith(
      'owner@example.com',
      'secret'
    );
    expect(navigate).toHaveBeenCalledWith(['/owner', 'dashboard']);
  });

  it('routes a seeded non-default owner using that owner profile config', () => {
    const loginAndExchange = jest.fn().mockReturnValue(of({}));
    const getSiteConfig = jest.fn().mockReturnValue(
      of({
        configId: 'config-handyman',
        config: {
          site: {
            slug: 'steady-hand-contracting',
            onboardingCompletedAt: '2026-06-13T10:00:00.000Z',
          },
          brand: {
            businessName: 'Steady Hand Contracting',
          },
        },
      })
    );

    TestBed.configureTestingModule({
      imports: [BusinessLoginPageComponent],
      providers: [
        emailAuthProvider,
        provideRouter([]),
        {
          provide: BusinessAuthService,
          useValue: { loginAndExchange },
        },
        {
          provide: BusinessApiService,
          useValue: { getSiteConfig },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(BusinessLoginPageComponent);
    fixture.componentInstance.email = 'owner-handyman@localbusiness.test';
    fixture.componentInstance.password = 'secret';
    fixture.detectChanges();

    fixture.componentInstance.onSubmit();

    expect(getSiteConfig).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/owner', 'dashboard']);
  });

  it('routes a first-time owner to onboarding after login', () => {
    const loginAndExchange = jest.fn().mockReturnValue(of({}));
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
      imports: [BusinessLoginPageComponent],
      providers: [
        emailAuthProvider,
        provideRouter([]),
        {
          provide: BusinessAuthService,
          useValue: { loginAndExchange },
        },
        {
          provide: BusinessApiService,
          useValue: { getSiteConfig },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(BusinessLoginPageComponent);
    fixture.componentInstance.email = 'owner@example.com';
    fixture.componentInstance.password = 'secret';
    fixture.detectChanges();

    fixture.componentInstance.onSubmit();

    expect(navigate).toHaveBeenCalledWith(['/owner', 'onboarding']);
  });

  it('shows an owner-client mode toggle and sends client mode to the client login route', () => {
    const loginAndExchange = jest.fn().mockReturnValue(of({}));
    const getSiteConfig = jest.fn().mockReturnValue(
      of({
        configId: 'config-1',
        config: {},
      })
    );

    TestBed.configureTestingModule({
      imports: [BusinessLoginPageComponent],
      providers: [
        emailAuthProvider,
        provideRouter([]),
        {
          provide: BusinessAuthService,
          useValue: { loginAndExchange },
        },
        {
          provide: BusinessApiService,
          useValue: { getSiteConfig },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(BusinessLoginPageComponent);
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('[data-auth-mode]')
    ) as HTMLButtonElement[];

    expect(buttons.map((button) => button.textContent?.trim())).toEqual(
      expect.arrayContaining(['Owner', 'Client'])
    );

    const clientButton = buttons.find(
      (button) => button.textContent?.trim() === 'Client'
    );
    clientButton?.click();

    expect(navigate).toHaveBeenCalledWith(['/client/login']);
    expect(loginAndExchange).not.toHaveBeenCalled();
  });

  it('links owner and client registration paths from the shared auth page', () => {
    const loginAndExchange = jest.fn().mockReturnValue(of({}));
    const getSiteConfig = jest.fn().mockReturnValue(
      of({
        configId: 'config-1',
        config: {},
      })
    );

    TestBed.configureTestingModule({
      imports: [BusinessLoginPageComponent],
      providers: [
        emailAuthProvider,
        provideRouter([]),
        {
          provide: BusinessAuthService,
          useValue: { loginAndExchange },
        },
        {
          provide: BusinessApiService,
          useValue: { getSiteConfig },
        },
      ],
    });

    const router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(BusinessLoginPageComponent);
    fixture.detectChanges();

    let links = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink));
    expect(links.map((link) => link.href)).toContain('/owner/register');

    fixture.componentInstance.setMode('client');
    fixture.detectChanges();

    links = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink));
    expect(links.map((link) => link.href)).toContain('/client/register');
  });

  it('keeps hosted owner auth routes tenant-scoped for links and redirects', () => {
    const loginAndExchange = jest.fn().mockReturnValue(of({}));
    const getSiteConfig = jest.fn().mockReturnValue(
      of({
        configId: 'config-hosted',
        config: {
          site: {
            onboardingCompletedAt: '2026-06-15T12:00:00.000Z',
          },
        },
      })
    );

    TestBed.configureTestingModule({
      imports: [BusinessLoginPageComponent],
      providers: [
        emailAuthProvider,
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
          useValue: { loginAndExchange },
        },
        {
          provide: BusinessApiService,
          useValue: { getSiteConfig },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(BusinessLoginPageComponent);
    fixture.componentInstance.email = 'owner@example.com';
    fixture.componentInstance.password = 'secret';
    fixture.detectChanges();

    const links = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink));
    expect(links.map((link) => link.href)).toContain(
      '/sites/steady-hand-contracting/owner/register'
    );

    fixture.componentInstance.setMode('client');
    expect(navigate).toHaveBeenCalledWith([
      '/sites',
      'steady-hand-contracting',
      'client',
      'login',
    ]);

    fixture.componentInstance.setMode('owner');
    fixture.componentInstance.onSubmit();

    expect(navigate).toHaveBeenCalledWith([
      '/sites',
      'steady-hand-contracting',
      'owner',
      'dashboard',
    ]);
  });
});
