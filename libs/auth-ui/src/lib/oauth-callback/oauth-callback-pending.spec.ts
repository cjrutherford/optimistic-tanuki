import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { OAuthCallbackComponent } from './oauth-callback.component';

interface RouterDouble {
  navigateByUrl: jest.Mock;
}
interface OpenerDouble {
  postMessage: jest.Mock;
}

const PENDING = '/api/oauth/pending/abc';

async function setup(
  query: Record<string, string>,
  opener: OpenerDouble | null = { postMessage: jest.fn() }
) {
  Object.defineProperty(window, 'opener', {
    configurable: true,
    value: opener,
  });
  const router: RouterDouble = { navigateByUrl: jest.fn() };
  await TestBed.configureTestingModule({
    imports: [OAuthCallbackComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: ActivatedRoute,
        useValue: {
          queryParams: of(query),
          snapshot: { paramMap: { get: () => null } },
        },
      },
      { provide: Router, useValue: router },
    ],
  }).compileComponents();
  const http = TestBed.inject(HttpTestingController);
  const fixture: ComponentFixture<OAuthCallbackComponent> =
    TestBed.createComponent(OAuthCallbackComponent);
  fixture.detectChanges();
  return { fixture, http, router, opener };
}

async function settle(fixture: ComponentFixture<OAuthCallbackComponent>) {
  await fixture.whenStable();
  fixture.detectChanges();
}

const linkQuery = {
  pending: 'link_account',
  pendingCode: 'abc',
  returnTo: 'http://localhost/dashboard',
  provider: 'github',
};

describe('OAuthCallbackComponent pending intents', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: null,
    });
  });

  describe('link_account', () => {
    it('asks to link with a password and relays the callback code to the opener', async () => {
      const { fixture, http, opener } = await setup(linkQuery);
      http.expectOne(PENDING).flush({
        kind: 'link_account',
        provider: 'github',
        maskedEmail: 'j***@example.com',
        methods: ['password'],
      });
      await settle(fixture);
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('j***@example.com');
      expect(text).toContain('Link Github');
      expect(
        fixture.nativeElement.querySelector('#link-password')
      ).toBeTruthy();

      fixture.componentInstance.password = 'hunter2';
      const submitted = fixture.componentInstance.submitLink();
      const req = http.expectOne(`${PENDING}/link`);
      expect(req.request.body).toEqual({ password: 'hunter2' });
      req.flush({
        callbackCode: 'cb-1',
        returnTo: 'http://localhost/dashboard',
      });
      await submitted;

      expect(opener?.postMessage).toHaveBeenCalledWith(
        {
          type: 'oauth-callback',
          payload: { success: true, callbackCode: 'cb-1' },
        },
        'http://localhost'
      );
    });

    it('lets the person choose between password and emailed code', async () => {
      const { fixture, http } = await setup(linkQuery);
      http.expectOne(PENDING).flush({
        kind: 'link_account',
        provider: 'github',
        maskedEmail: 'j***@example.com',
        methods: ['password', 'email_code'],
      });
      await settle(fixture);
      expect(
        fixture.nativeElement.querySelector('#link-password')
      ).toBeTruthy();
      expect(fixture.nativeElement.textContent).toContain(
        'Email me a code instead'
      );
      fixture.componentInstance.chooseLinkMethod('email_code');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#link-password')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Use my password');
    });

    it('emails a code, then links with it', async () => {
      const { fixture, http } = await setup(linkQuery);
      http.expectOne(PENDING).flush({
        kind: 'link_account',
        provider: 'github',
        maskedEmail: 'j***@example.com',
        methods: ['email_code'],
      });
      await settle(fixture);
      expect(fixture.nativeElement.querySelector('#link-password')).toBeNull();

      const sent = fixture.componentInstance.sendEmailCode();
      http.expectOne(`${PENDING}/link/email-code`).flush({});
      await sent;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#link-code')).toBeTruthy();

      fixture.componentInstance.emailCode = '123456';
      const submitted = fixture.componentInstance.submitLink();
      const req = http.expectOne(`${PENDING}/link`);
      expect(req.request.body).toEqual({ emailCode: '123456' });
      req.flush({ callbackCode: 'cb-2', returnTo: 'http://localhost/' });
      await submitted;
    });

    it('shows a wrong credential inline with attempts left and stays on the step', async () => {
      const { fixture, http, opener } = await setup(linkQuery);
      http.expectOne(PENDING).flush({
        kind: 'link_account',
        provider: 'github',
        maskedEmail: 'j***@example.com',
        methods: ['password'],
      });
      await settle(fixture);
      fixture.componentInstance.password = 'nope';
      const submitted = fixture.componentInstance.submitLink();
      http
        .expectOne(`${PENDING}/link`)
        .flush(
          { error: 'link_credentials_invalid', attemptsRemaining: 3 },
          { status: 401, statusText: 'Unauthorized' }
        );
      await submitted;
      fixture.detectChanges();

      expect(fixture.componentInstance.stepError).toContain('3 attempts left');
      expect(fixture.componentInstance.view).toBe('link');
      expect(opener?.postMessage).not.toHaveBeenCalled();
    });

    it('ends with a start-over action when attempts are exhausted', async () => {
      const { fixture, http, opener, router } = await setup(linkQuery, null);
      http.expectOne(PENDING).flush({
        kind: 'link_account',
        provider: 'github',
        maskedEmail: 'j***@example.com',
        methods: ['password'],
      });
      await settle(fixture);
      const submitted = fixture.componentInstance.submitLink();
      http
        .expectOne(`${PENDING}/link`)
        .flush(
          { error: 'link_attempts_exhausted' },
          { status: 401, statusText: 'Unauthorized' }
        );
      await submitted;
      fixture.detectChanges();

      expect(fixture.componentInstance.error).toContain('Too many');
      expect(fixture.nativeElement.textContent).toContain('Start over');
      expect(opener).toBeNull();
      fixture.componentInstance.startOver();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    });

    it('cancel calls the gateway and reports cancellation to the opener', async () => {
      const { fixture, http, opener } = await setup(linkQuery);
      http.expectOne(PENDING).flush({
        kind: 'link_account',
        provider: 'github',
        maskedEmail: 'j***@example.com',
        methods: ['password'],
      });
      await settle(fixture);
      const cancelled = fixture.componentInstance.cancel();
      http.expectOne(`${PENDING}/cancel`).flush({});
      await cancelled;

      expect(opener?.postMessage).toHaveBeenCalledWith(
        {
          type: 'oauth-callback',
          payload: {
            success: false,
            error: 'oauth_cancelled',
            errorDescription: undefined,
          },
        },
        window.location.origin
      );
    });

    it('maps an expired intent to a specific message', async () => {
      const { fixture, http } = await setup(linkQuery);
      http
        .expectOne(PENDING)
        .flush({}, { status: 404, statusText: 'Not Found' });
      await settle(fixture);
      expect(fixture.componentInstance.errorView?.code).toBe('pending_expired');
      expect(fixture.nativeElement.textContent).toContain('Start over');
    });
  });

  describe('age_verification', () => {
    const ageQuery = {
      pending: 'age_verification',
      pendingCode: 'abc',
      returnTo: 'http://localhost/',
      provider: 'google',
    };

    async function toAgeStep() {
      const ctx = await setup(ageQuery);
      ctx.http.expectOne(PENDING).flush({
        kind: 'age_verification',
        provider: 'google',
        appScope: 'local-hub',
        methods: [],
      });
      await settle(ctx.fixture);
      return ctx;
    }

    it('continues with the callback code after an eligible date of birth', async () => {
      const { fixture, http, opener } = await toAgeStep();
      expect(
        fixture.nativeElement.querySelector('#dob-step-date')
      ).toBeTruthy();
      const done = fixture.componentInstance.submitAge({
        dateOfBirth: '1990-01-01',
      });
      const req = http.expectOne(`${PENDING}/age`);
      expect(req.request.body).toEqual({ dateOfBirth: '1990-01-01' });
      req.flush({ callbackCode: 'cb-3', returnTo: 'http://localhost/' });
      await done;
      expect(opener?.postMessage).toHaveBeenCalledWith(
        {
          type: 'oauth-callback',
          payload: { success: true, callbackCode: 'cb-3' },
        },
        'http://localhost'
      );
    });

    it('shows the check-your-email message when verification is required', async () => {
      const { fixture, http } = await toAgeStep();
      const done = fixture.componentInstance.submitAge({
        dateOfBirth: '1990-01-01',
      });
      http.expectOne(`${PENDING}/age`).flush({ verificationRequired: true });
      await done;
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Check your email');
    });

    it('hands off to the guardian message when consent is required', async () => {
      const { fixture, http } = await toAgeStep();
      const done = fixture.componentInstance.submitAge({
        dateOfBirth: '2012-01-01',
        guardianEmail: 'parent@example.com',
      });
      const req = http.expectOne(`${PENDING}/age`);
      expect(req.request.body.guardianEmail).toBe('parent@example.com');
      req.flush(
        {
          error: 'guardian_consent_required',
          data: { guardianConsentPending: true },
        },
        { status: 403, statusText: 'Forbidden' }
      );
      await done;
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'Guardian permission needed'
      );
      expect(fixture.nativeElement.textContent).toContain(
        "We've emailed parent@example.com to ask for permission"
      );
    });

    it('explains age_ineligible', async () => {
      const { fixture, http } = await toAgeStep();
      const done = fixture.componentInstance.submitAge({
        dateOfBirth: '2020-01-01',
      });
      http
        .expectOne(`${PENDING}/age`)
        .flush(
          { error: 'age_ineligible' },
          { status: 403, statusText: 'Forbidden' }
        );
      await done;
      fixture.detectChanges();
      expect(fixture.componentInstance.error).toContain('at least 13');
    });
  });
});
