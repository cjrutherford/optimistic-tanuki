import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReturnIntentService } from './return-intent.service';

describe('ReturnIntentService', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('stores an absolute current-origin URL as a normalized same-origin path', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });

    const service = TestBed.inject(ReturnIntentService);
    service.remember(
      `${window.location.origin}/workspaces/one?tab=theme#preview`
    );

    expect(
      sessionStorage.getItem('hai-system-configurator-return-intent')
    ).toBe('/workspaces/one?tab=theme#preview');
    expect(
      localStorage.getItem('hai-system-configurator-return-intent')
    ).toBeNull();
  });

  it('does not store an external return URL', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });

    const service = TestBed.inject(ReturnIntentService);
    service.remember('https://evil.example/phish');

    expect(
      sessionStorage.getItem('hai-system-configurator-return-intent')
    ).toBeNull();
    expect(service.consume()).toBeNull();
  });

  it('consumes a stored path once and discards tampered values', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });

    const service = TestBed.inject(ReturnIntentService);
    service.remember('/workspaces/one/sites/alpha');

    expect(service.consume()).toBe('/workspaces/one/sites/alpha');
    expect(service.consume()).toBeNull();

    sessionStorage.setItem(
      'hai-system-configurator-return-intent',
      'https://evil.example/phish'
    );
    expect(service.consume()).toBeNull();
    expect(
      sessionStorage.getItem('hai-system-configurator-return-intent')
    ).toBeNull();
  });
});
