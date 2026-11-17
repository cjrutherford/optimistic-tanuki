import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { of } from 'rxjs';
import { DirectoryLinkReviewPageComponent } from './directory-link-review-page.component';
const town = '11111111-1111-4111-8111-111111111111',
  listing = '22222222-2222-4222-8222-222222222222',
  page = '33333333-3333-4333-8333-333333333333',
  owner = '44444444-4444-4444-8444-444444444444',
  requestId = '55555555-5555-4555-8555-555555555555';
describe('DirectoryLinkReviewPageComponent', () => {
  beforeEach(async () =>
    TestBed.configureTestingModule({
      imports: [DirectoryLinkReviewPageComponent, HttpClientTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ communityId: town })) },
        },
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    }).compileComponents()
  );
  it('requires a comparison and evidence before approving a request', () => {
    const fixture = TestBed.createComponent(DirectoryLinkReviewPageComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const request = {
      listingId: listing,
      businessCommunityId: page,
      ownerId: owner,
      requestId,
    };
    http
      .expectOne(`/api/directory/towns/${town}/business-link-requests`)
      .flush({ requests: [request], nextCursor: null });
    const component = fixture.componentInstance;
    component.inspect(request);
    http
      .expectOne(
        `/api/directory/towns/${town}/local-evaluation-listings/${listing}`
      )
      .flush({ name: 'Cafe', category: 'restaurant' });
    http
      .expectOne(`/api/social/community/${page}`)
      .flush({ id: page, name: 'Cafe page', slug: 'cafe' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cafe page');
    component.decide(request, 'approve', 'https://example.org/business', false);
    http.expectNone(
      `/api/directory/towns/${town}/local-evaluation-listings/${listing}/business-link/reviews`
    );
    component.decide(request, 'approve', 'https://example.org/business', true);
    const review = http.expectOne(
      `/api/directory/towns/${town}/local-evaluation-listings/${listing}/business-link/reviews`
    );
    expect(review.request.body.attested).toBe(true);
    review.flush({ recorded: true });
    http
      .expectOne(`/api/directory/towns/${town}/business-link-requests`)
      .flush({ requests: [], nextCursor: null });
    http.verify();
  });
});
