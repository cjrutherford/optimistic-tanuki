import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { TitleService } from './title.service';

describe('TitleService', () => {
  let events: Subject<unknown>;
  let router: { events: Subject<unknown>; url: string };

  const configure = (platformId: string, url = '/') => {
    events = new Subject<unknown>();
    router = { events, url };
    TestBed.configureTestingModule({
      providers: [
        TitleService,
        { provide: Router, useValue: router },
        { provide: PLATFORM_ID, useValue: platformId },
      ],
    });
    return TestBed.inject(TitleService);
  };

  afterEach(() => {
    document.title = '';
    TestBed.resetTestingModule();
  });

  it('sets the default title for an unknown route on construction', () => {
    configure('browser', '/somewhere-else');
    expect(document.title).toBe('Optimistic Tanuki');
  });

  it('sets the mapped title for a known route on construction', () => {
    configure('browser', '/feed');
    expect(document.title).toBe('Feed');
  });

  it('matches child routes by prefix', () => {
    configure('browser', '/profile/abc-123');
    expect(document.title).toBe('Profile');
  });

  it('updates the title on NavigationEnd using the redirected url', () => {
    configure('browser', '/');
    events.next(new NavigationEnd(1, '/x', '/messages'));
    expect(document.title).toBe('Messages');
  });

  it('ignores router events that are not NavigationEnd', () => {
    configure('browser', '/feed');
    events.next(new NavigationStart(1, '/messages'));
    expect(document.title).toBe('Feed');
  });

  it('matches the first configured route that matches the url', () => {
    // '/settings' is listed before '/settings/privacy', so the prefix match wins.
    configure('browser', '/settings/privacy');
    expect(document.title).toBe('Settings');
  });

  it('sets a custom title verbatim', () => {
    const service = configure('browser', '/');
    service.setTitle('Custom');
    expect(document.title).toBe('Custom');
  });

  it('suffixes a custom title with the default title', () => {
    const service = configure('browser', '/');
    service.setTitleWithDefault('Custom');
    expect(document.title).toBe('Custom | Optimistic Tanuki');
  });

  describe('on the server', () => {
    it('does not subscribe to the router or touch the document title', () => {
      document.title = 'untouched';
      const service = configure('server', '/feed');

      expect(document.title).toBe('untouched');
      expect(events.observed).toBe(false);

      service.updateTitle('/feed');
      service.setTitle('Custom');
      service.setTitleWithDefault('Custom');

      expect(document.title).toBe('untouched');
    });
  });
});
