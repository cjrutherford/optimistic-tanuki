import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import {
  EmailActionComponent,
  emailAuthRoutes,
  parseEmailActionToken,
} from './email-action.component';
import { EmailAuthClientService } from '../services/email-auth.service';

describe('parseEmailActionToken', () => {
  it('reads the token from a URL fragment', () => {
    expect(parseEmailActionToken('#token=abc%20123')).toBe('abc 123');
  });

  it('creates all three app-local callback routes with the app storage key', () => {
    const routes = emailAuthRoutes('product-auth-token');
    expect(routes.map((route) => route.path)).toEqual([
      'auth/verify',
      'auth/magic-link',
      'auth/reset-password',
    ]);
    expect(routes[0].data?.['storageKey']).toBe('product-auth-token');
  });

  it('returns an empty value when the token is absent', () => {
    expect(parseEmailActionToken('#other=value')).toBe('');
  });
});

describe('EmailActionComponent', () => {
  let fixture: ComponentFixture<EmailActionComponent>;
  const emailAuth = {
    confirmVerification: jest.fn(() =>
      of({ message: 'Email verified', code: 0 })
    ),
  };

  beforeEach(async () => {
    emailAuth.confirmVerification.mockClear();
    await TestBed.configureTestingModule({
      imports: [EmailActionComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: { purpose: 'verification', storageKey: 'test-token' },
              queryParamMap: convertToParamMap({ token: 'verification-token' }),
            },
          },
        },
        { provide: EmailAuthClientService, useValue: emailAuth },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(EmailActionComponent);
  });

  it('automatically records email verification and offers login without storing a session', () => {
    fixture.detectChanges();

    expect(emailAuth.confirmVerification).toHaveBeenCalledWith(
      'verification-token'
    );
    expect(fixture.nativeElement.textContent).toContain('Continue to sign in');
    expect(fixture.nativeElement.textContent).toContain(
      'Your email address has been verified.'
    );
    expect(
      fixture.nativeElement
        .querySelector('main')
        .getAttribute('aria-labelledby')
    ).toBe('email-action-heading');
    expect(
      fixture.nativeElement
        .querySelector('a')
        .classList.contains('email-action-link')
    ).toBe(true);
  });

  it('automatically consumes a magic link and returns to its safe path', async () => {
    const confirmLogin = jest.fn(() =>
      of({
        returnPath: '/account',
        data: { newToken: 'magic-session' },
      })
    );
    const navigateByUrl = jest.fn().mockResolvedValue(true);
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [EmailActionComponent],
        providers: [
          { provide: PLATFORM_ID, useValue: 'browser' },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                data: { purpose: 'magic-link', storageKey: 'test-token' },
                queryParamMap: convertToParamMap({ token: 'magic-token' }),
              },
            },
          },
          { provide: Router, useValue: { navigateByUrl } },
          {
            provide: EmailAuthClientService,
            useValue: { confirmLogin },
          },
        ],
      })
      .compileComponents();

    const magicFixture = TestBed.createComponent(EmailActionComponent);
    magicFixture.detectChanges();

    expect(confirmLogin).toHaveBeenCalledWith('magic-link', 'magic-token');
    expect(localStorage.getItem('test-token')).toBe('magic-session');
    expect(navigateByUrl).toHaveBeenCalledWith('/account');
  });

  it('uses the verified action return path as its continuation link', async () => {
    const confirmVerification = jest.fn(() =>
      of({ message: 'Email verified', code: 0, returnPath: '/welcome' })
    );
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [EmailActionComponent],
        providers: [
          provideRouter([]),
          { provide: PLATFORM_ID, useValue: 'browser' },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                data: { purpose: 'verification', storageKey: 'test-token' },
                queryParamMap: convertToParamMap({
                  token: 'verification-token',
                }),
              },
            },
          },
          {
            provide: EmailAuthClientService,
            useValue: { confirmVerification },
          },
        ],
      })
      .compileComponents();

    const verificationFixture = TestBed.createComponent(EmailActionComponent);
    verificationFixture.detectChanges();
    verificationFixture.detectChanges();

    expect(
      verificationFixture.nativeElement.querySelector('a').getAttribute('href')
    ).toBe('/welcome');
  });
});
