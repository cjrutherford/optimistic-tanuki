import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import {
  OAuthCallbackComponent,
  oauthCallbackReferrerPolicy,
  oauthCallbackRoutes,
} from '../../index';

describe('OAuthCallbackComponent', () => {
  it('sets a no-referrer response header for the callback document', () => {
    const setHeader = jest.fn();
    const next = jest.fn();

    oauthCallbackReferrerPolicy(
      { path: '/oauth/callback' },
      { setHeader },
      next
    );

    expect(setHeader).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not change the referrer policy for other application responses', () => {
    const setHeader = jest.fn();
    const next = jest.fn();

    oauthCallbackReferrerPolicy({ path: '/login' }, { setHeader }, next);

    expect(setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('exports the app-local OAuth callback route', () => {
    expect(oauthCallbackRoutes).toEqual([
      { path: 'oauth/callback', component: OAuthCallbackComponent },
    ]);
  });

  it('can render without an API_BASE_URL provider', async () => {
    await TestBed.configureTestingModule({
      imports: [OAuthCallbackComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({}),
            snapshot: { paramMap: { get: () => null } },
          },
        },
        { provide: Router, useValue: { navigateByUrl: jest.fn() } },
      ],
    }).compileComponents();

    const fixture: ComponentFixture<OAuthCallbackComponent> =
      TestBed.createComponent(OAuthCallbackComponent);

    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('relays a provider code through same-origin /api without an API_BASE_URL provider', async () => {
    const location = {
      search: '?code=authorization-code&state=oauth-state',
      replace: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [OAuthCallbackComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({ code: 'authorization-code' }),
            snapshot: { paramMap: { get: () => 'google' } },
          },
        },
        { provide: Router, useValue: { navigateByUrl: jest.fn() } },
        { provide: DOCUMENT, useValue: { location } },
      ],
    }).compileComponents();

    TestBed.runInInjectionContext(() => {
      new OAuthCallbackComponent(TestBed.inject(ActivatedRoute)).ngOnInit();
    });

    expect(location.replace).toHaveBeenCalledWith(
      '/api/oauth/callback/google?code=authorization-code&state=oauth-state'
    );
  });

  it('does not relay provider codes while rendering on the server', async () => {
    const location = {
      search: '?code=authorization-code',
      replace: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [OAuthCallbackComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({ code: 'authorization-code' }),
            snapshot: { paramMap: { get: () => 'google' } },
          },
        },
        { provide: Router, useValue: { navigateByUrl: jest.fn() } },
        { provide: DOCUMENT, useValue: { location } },
      ],
    }).compileComponents();

    TestBed.runInInjectionContext(() => {
      new OAuthCallbackComponent(TestBed.inject(ActivatedRoute)).ngOnInit();
    });

    expect(location.replace).not.toHaveBeenCalled();
  });

  it('redeems a callback code and posts the platform token without reading it from the URL', async () => {
    const location = {
      search: '?callbackCode=one-time-code',
      replace: jest.fn(),
    };
    const postMessage = jest.fn();
    const replaceState = jest.spyOn(window.history, 'replaceState');
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: { postMessage },
    });
    await TestBed.configureTestingModule({
      imports: [OAuthCallbackComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({ callbackCode: 'one-time-code' }),
            snapshot: { paramMap: { get: () => null } },
          },
        },
        { provide: Router, useValue: { navigateByUrl: jest.fn() } },
        { provide: DOCUMENT, useValue: { location } },
      ],
    }).compileComponents();

    TestBed.runInInjectionContext(() =>
      new OAuthCallbackComponent(TestBed.inject(ActivatedRoute)).ngOnInit()
    );
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne('/api/oauth/callback/redeem');
    expect(replaceState).toHaveBeenCalledWith(
      null,
      '',
      expect.not.stringContaining('callbackCode')
    );
    expect(request.request.body).toEqual({ callbackCode: 'one-time-code' });
    request.flush({ token: 'platform-token' });
    await Promise.resolve();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { success: true, token: 'platform-token' },
      }),
      window.location.origin
    );
    http.verify();
    replaceState.mockRestore();
  });
});
