import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
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
    expect(fixture.nativeElement.textContent).toContain('Sign in');
    expect(fixture.nativeElement.textContent).toContain(
      'Your email address has been verified.'
    );
  });
});
