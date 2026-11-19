import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/civic-briefing-data-access';
import { of, throwError } from 'rxjs';
import { AuthStateService } from '../../services/auth-state.service';
import { CommunityService } from '../../services/community.service';
import {
  TownSourcesService,
  type TownSourceStatus,
} from '../../services/town-sources.service';
import { CityBriefingPageComponent } from './city-briefing-page.component';

interface CommunityServiceDouble {
  getCityBySlug: jest.Mock;
}

interface TownSourcesDouble {
  status: jest.Mock;
  request: jest.Mock;
}

interface CivicDouble {
  edition: jest.Mock;
  latest: jest.Mock;
  briefing: jest.Mock;
  surface: jest.Mock;
}

const notFound = () => throwError(() => new HttpErrorResponse({ status: 404 }));

describe('CityBriefingPageComponent', () => {
  async function render(
    params: Record<string, string>,
    city: unknown,
    options: { status?: Promise<TownSourceStatus>; published?: boolean } = {}
  ): Promise<HTMLElement> {
    const townSources: TownSourcesDouble = {
      status: jest
        .fn()
        .mockReturnValue(
          options.status ?? Promise.reject(new Error('not asked'))
        ),
      request: jest.fn(),
    };
    const civic: CivicDouble = {
      edition: jest.fn().mockImplementation(notFound),
      latest: jest.fn().mockImplementation(notFound),
      briefing: jest.fn().mockImplementation(notFound),
      surface: jest.fn().mockImplementation(notFound),
    };
    const communities: CommunityServiceDouble = {
      getCityBySlug: jest.fn().mockResolvedValue(city),
    };
    TestBed.configureTestingModule({
      imports: [CityBriefingPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CommunityService, useValue: communities },
        { provide: TownSourcesService, useValue: townSources },
        { provide: OptomisitcTanukiAPIService, useValue: civic },
        {
          provide: AuthStateService,
          useValue: { isAuthenticated$: of(false) },
        },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap(params)) },
        },
      ],
    });
    const fixture = TestBed.createComponent(CityBriefingPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const adel = { name: 'Adel', slug: 'adel-ga', localitySlug: 'adel-ga' };

  it('titles the page with the town and the day', async () => {
    const page = await render({ slug: 'adel-ga', date: '2026-09-23' }, adel);
    expect(page.querySelector('h1')?.textContent).toBe('Adel');
    expect(page.querySelector('app-city-briefing')).not.toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe(
      'Daylight: Adel, Wednesday, September 23, 2026 - Towne Square'
    );
  });

  it('says so when the town has no briefings', async () => {
    const page = await render(
      { slug: 'savannah-ga' },
      { name: 'Savannah', slug: 'savannah-ga', localitySlug: null }
    );
    expect(page.querySelector('app-city-briefing')).toBeNull();
    expect(page.textContent).toContain("Daylight doesn't cover Savannah yet.");
  });

  it('says so when the town does not exist', async () => {
    const page = await render({ slug: 'nowhere' }, undefined);
    expect(page.textContent).toContain("That town couldn't be found.");
  });

  describe('a town without sources', () => {
    const status = (
      value: TownSourceStatus['status'],
      requestCount = 2
    ): Promise<TownSourceStatus> =>
      Promise.resolve({
        slug: 'adel-ga',
        name: 'Adel',
        status: value,
        requestCount,
      });

    it('shows the no-sources note with the three actions when nothing is published', async () => {
      const page = await render({ slug: 'adel-ga' }, adel, {
        status: status('no-sources'),
      });
      expect(page.querySelector('app-city-briefing')).toBeNull();
      expect(page.querySelector('h2')?.textContent).toContain(
        'No sources yet for Adel'
      );
      const labels = Array.from(page.querySelectorAll('.actions .action')).map(
        (el) => el.textContent?.trim()
      );
      expect(labels).toEqual([
        'Request sources',
        'Partner with us',
        'Post sources',
      ]);
    });

    it('says Daylight is still looking when the town has not been sourced yet', async () => {
      const page = await render({ slug: 'adel-ga' }, adel, {
        status: status('not-sourced-yet'),
      });
      expect(page.querySelector('h2')?.textContent).toContain(
        'Daylight is still looking for sources for Adel'
      );
      expect(page.querySelectorAll('.actions .action')).toHaveLength(3);
    });

    it('leaves the page alone for a town with sources', async () => {
      const page = await render({ slug: 'adel-ga' }, adel, {
        status: status('has-sources'),
      });
      expect(page.querySelector('app-town-sources-note')).toBeNull();
      expect(page.querySelector('app-city-briefing')).not.toBeNull();
    });

    it('falls back to the current page when the status call fails', async () => {
      const page = await render({ slug: 'adel-ga' }, adel, {
        status: Promise.reject(new HttpErrorResponse({ status: 404 })),
      });
      expect(page.querySelector('app-town-sources-note')).toBeNull();
      const feed = page.querySelector<HTMLElement>('app-city-briefing');
      expect(feed).not.toBeNull();
      expect(feed?.hidden).toBe(false);
    });

    it('holds back the empty feed until the status call settles', async () => {
      const page = await render({ slug: 'adel-ga' }, adel, {
        status: new Promise<TownSourceStatus>(() => undefined),
      });
      const feed = page.querySelector<HTMLElement>('app-city-briefing');
      expect(feed?.hidden).toBe(true);
      expect(page.querySelector('app-town-sources-note')).toBeNull();
    });
  });
});
