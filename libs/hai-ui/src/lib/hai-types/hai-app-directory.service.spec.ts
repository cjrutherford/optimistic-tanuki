import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { HaiAppDirectoryService } from './hai-app-directory.service';

describe('HaiAppDirectoryService', () => {
  let service: HaiAppDirectoryService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HaiAppDirectoryService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('uses the published registry destination and preserves its route', () => {
    service.getResolvedApps('optimistic-tanuki').subscribe((apps) => {
      expect(apps.find((app) => app.appId === 'towne-square')?.runUrl).toBe(
        'https://published.example.com/towns/'
      );
      expect(apps.some((app) => app.appId === 'optimistic-tanuki')).toBe(false);
    });
    http.expectOne('/api/registry/apps').flush({
      success: true,
      data: {
        apps: [
          {
            appId: 'local-hub',
            uiBaseUrl: 'https://published.example.com/towns/',
            visibility: 'public',
          },
        ],
      },
    });
  });

  it.each([false, true])(
    'does not invent localhost destinations when the registry is unavailable (HTTP error: %s)',
    (error) => {
      service.getResolvedApps().subscribe((apps) => {
        expect(apps.every((app) => !app.runUrl && !app.isPublic)).toBe(true);
        expect(
          apps.every((app) => app.resolvedHref === app.repositoryUrl)
        ).toBe(true);
      });
      const request = http.expectOne('/api/registry/apps');
      if (error) request.flush({}, { status: 503, statusText: 'Unavailable' });
      else request.flush({ success: false });
    }
  );

  describe('getPublicAppUrl', () => {
    it('gives the URL the registry publishes for the environment', () => {
      let url: string | undefined;
      service
        .getPublicAppUrl('system-configurator')
        .subscribe((u) => (url = u));
      http.expectOne('/api/registry/apps').flush({
        success: true,
        data: {
          apps: [
            {
              appId: 'system-configurator',
              uiBaseUrl: 'https://hardware.example.com',
              visibility: 'public',
            },
          ],
        },
      });
      expect(url).toBe('https://hardware.example.com');
    });

    it.each([false, true])(
      'gives undefined, not a localhost default, when the registry fails (HTTP error: %s)',
      (error) => {
        const seen: (string | undefined)[] = [];
        service
          .getPublicAppUrl('system-configurator')
          .subscribe((u) => seen.push(u));
        const request = http.expectOne('/api/registry/apps');
        if (error)
          request.flush({}, { status: 503, statusText: 'Unavailable' });
        else request.flush({ success: false });
        expect(seen).toEqual([undefined]);
      }
    );
  });
});
