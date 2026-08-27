import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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
      { path: 'oauth/callback/:provider', component: OAuthCallbackComponent },
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

  it('keeps the gateway error description visible when the popup has no opener', async () => {
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: null,
    });

    await TestBed.configureTestingModule({
      imports: [OAuthCallbackComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({
              error: 'email_verification_required',
              error_description: 'Verify the Microsoft account email first.',
            }),
            snapshot: { paramMap: { get: () => null } },
          },
        },
        { provide: Router, useValue: { navigateByUrl: jest.fn() } },
      ],
    }).compileComponents();

    const component = TestBed.runInInjectionContext(
      () => new OAuthCallbackComponent(TestBed.inject(ActivatedRoute))
    );
    component.ngOnInit();

    expect(component.error).toBe('Verify the Microsoft account email first.');
  });

  it('relays the one-time callback code without redeeming it on the callback host', async () => {
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
    expect(replaceState).toHaveBeenCalledWith(
      null,
      '',
      expect.not.stringContaining('callbackCode')
    );
    await Promise.resolve();
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          success: true,
          callbackCode: 'one-time-code',
        }),
      }),
      window.location.origin
    );
    replaceState.mockRestore();
  });

  it('relays a cookie-session callback code without redeeming on the proxy host', async () => {
    const location = {
      search: '?callbackCode=one-time-code',
      replace: jest.fn(),
    };
    const postMessage = jest.fn();
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: { postMessage },
    });
    await TestBed.configureTestingModule({
      imports: [OAuthCallbackComponent],
      providers: [
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
    await Promise.resolve();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { success: true, callbackCode: 'one-time-code' },
      }),
      window.location.origin
    );
  });
});
