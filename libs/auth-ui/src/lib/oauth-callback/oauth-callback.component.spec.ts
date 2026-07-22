import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { OAuthCallbackComponent, oauthCallbackRoutes } from '../../index';

describe('OAuthCallbackComponent', () => {
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
});
