import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';
import { CommunityService } from '../../services/community.service';
import { CityBriefingPageComponent } from './city-briefing-page.component';

interface CommunityServiceDouble {
  getCityBySlug: jest.Mock;
}

describe('CityBriefingPageComponent', () => {
  async function render(
    params: Record<string, string>,
    city: unknown
  ): Promise<HTMLElement> {
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
    expect(page.querySelector('h1')?.textContent).toBe('Adel briefing');
    expect(page.querySelector('app-city-briefing')).not.toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe(
      'Adel briefing, Wednesday, September 23, 2026 - Towne Square'
    );
  });

  it('says so when the town has no briefings', async () => {
    const page = await render(
      { slug: 'savannah-ga' },
      { name: 'Savannah', slug: 'savannah-ga', localitySlug: null }
    );
    expect(page.querySelector('app-city-briefing')).toBeNull();
    expect(page.textContent).toContain("Savannah doesn't have briefings yet.");
  });

  it('says so when the town does not exist', async () => {
    const page = await render({ slug: 'nowhere' }, undefined);
    expect(page.textContent).toContain("That town couldn't be found.");
  });
});
