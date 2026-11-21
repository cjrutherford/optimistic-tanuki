import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { CommunityService } from '../../services/community.service';
import {
  DirectoryRequestError,
  DirectoryService,
} from '../../services/directory.service';
import { BusinessDetailComponent } from './business-detail.component';

const city = { id: 'c1', name: 'Valdosta', slug: 'valdosta-ga' };
const listing = {
  name: 'Fixture Bakery',
  category: 'bakery',
  attribution: ['Source credit'],
  notices: ['Required notice'],
  termsUrls: ['https://example.test/terms'],
};

interface DirectoryDouble {
  getListing: jest.Mock;
  getPage: jest.Mock;
}

describe('BusinessDetailComponent', () => {
  let fixture: ComponentFixture<BusinessDetailComponent>;
  let directory: DirectoryDouble;
  const setTitle = jest.fn();
  const text = () => fixture.nativeElement.textContent as string;

  const create = async (query: Record<string, string> = {}) => {
    await TestBed.configureTestingModule({
      imports: [BusinessDetailComponent, RouterTestingModule],
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: DirectoryService, useValue: directory },
        {
          provide: CommunityService,
          useValue: { getCityBySlug: jest.fn().mockResolvedValue(city) },
        },
        { provide: Title, useValue: { setTitle } },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(
              convertToParamMap({ slug: 'valdosta-ga', reference: 'ref-1' })
            ),
            queryParamMap: of(convertToParamMap(query)),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(BusinessDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    directory = {
      getListing: jest.fn().mockResolvedValue(listing),
      getPage: jest.fn().mockResolvedValue({
        sourceFreshness: null,
        coverage: null,
        listings: [],
      }),
    };
  });

  it('shows the listing with attribution, notices and a report link', async () => {
    await create();
    expect(directory.getListing).toHaveBeenCalledWith('c1', 'ref-1', false);
    expect(text()).toContain('Fixture Bakery');
    expect(text()).toContain('Source credit');
    expect(text()).toContain('Required notice');
    expect(
      fixture.nativeElement
        .querySelector('[data-testid="detail-report"]')
        ?.getAttribute('href')
    ).toContain('/city/valdosta-ga/businesses/ref-1/report');
    expect(
      fixture.nativeElement
        .querySelector('[data-testid="detail-back"]')
        ?.getAttribute('href')
    ).toContain('/city/valdosta-ga/businesses');
  });

  it('passes the adult flag from the URL', async () => {
    await create({ adult: '1' });
    expect(directory.getListing).toHaveBeenCalledWith('c1', 'ref-1', true);
  });

  it('says the link expired and offers the list when the reference is gone', async () => {
    directory.getListing.mockResolvedValue(null);
    await create();
    expect(text()).toContain('This listing link has expired');
    expect(
      fixture.nativeElement.querySelector('[data-testid="detail-back"]')
    ).not.toBeNull();
  });

  it('shows generic failure copy when the service is down', async () => {
    directory.getListing.mockRejectedValue(new DirectoryRequestError(503));
    await create();
    expect(
      fixture.nativeElement.querySelector('[data-testid="detail-failed"]')
    ).not.toBeNull();
  });

  it('reads freshness and coverage from the first page on a direct link', async () => {
    directory.getPage.mockResolvedValue({
      listings: [],
      sourceFreshness: {
        state: 'stale',
        releaseId: 'r',
        sourcePublishedAt: '2026-10-22T03:00:00Z',
        acquiredAt: null,
        thresholds: { freshDays: 90, staleDays: 120 },
      },
      coverage: null,
    });
    await create();
    expect(directory.getPage).toHaveBeenCalled();
    expect(text()).toContain('out of date');
  });
});
