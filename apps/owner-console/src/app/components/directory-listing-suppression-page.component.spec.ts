import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  DirectoryListingSuppressionPageComponent,
  REFUSED_MESSAGE,
} from './directory-listing-suppression-page.component';

const town = '615482e8-d72b-4500-989f-5b79ceb32781';
const listing = 'b52cfef1-9180-46ba-96d8-cca7149f9bdf';
const open = 'e52cfef1-9180-46ba-96d8-cca7149f9bdf';
const url = `http://localhost:3000/api/directory/towns/${town}/listing-suppressions`;
const searchUrl = `http://localhost:3000/api/directory/towns/${town}/local-evaluation-listings`;
const newId = 'd0000000-0000-4000-8000-000000000001';
const list = {
  suppressions: [
    {
      suppressionId: open,
      listingId: listing,
      listingName: 'Corner Cafe',
      reasonCode: 'safety',
      note: 'internal note',
      actorId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      liftedAt: null,
      liftReasonCode: null,
      liftedById: null,
    },
    {
      suppressionId: 'f52cfef1-9180-46ba-96d8-cca7149f9bdf',
      listingId: listing,
      listingName: 'Corner Cafe',
      reasonCode: 'duplicate',
      note: null,
      actorId: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      liftedAt: '2025-02-01T00:00:00.000Z',
      liftReasonCode: 'resolved',
      liftedById: null,
    },
  ],
};

describe('DirectoryListingSuppressionPageComponent', () => {
  let fixture: ComponentFixture<DirectoryListingSuppressionPageComponent>;
  let component: DirectoryListingSuppressionPageComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    const ids = [newId, 'd0000000-0000-4000-8000-000000000002'];
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => ids.shift() },
    });
    await TestBed.configureTestingModule({
      imports: [
        DirectoryListingSuppressionPageComponent,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api' },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ communityId: town })) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DirectoryListingSuppressionPageComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(url).flush(list);
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    http.verify();
  });

  const fill = (attested = true) => {
    component.setListing(listing);
    component.setReason('incorrect-details');
    component.setNote(' wrong hours ');
    component.setAttested(attested);
  };

  it('renders open and lifted suppressions with the correction rule', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Corner Cafe');
    expect(text).toContain('Suppressed');
    expect(text).toContain('Lifted');
    expect(text).toContain('sent back to address review');
    expect(component.isOpen(list.suppressions[0] as never)).toBe(true);
  });

  it('refuses to submit without deliberate confirmation', () => {
    component.openSuppress(listing);
    fill(false);
    component.submit();
    http.expectNone(url);
    expect(component.message).toContain('Confirm');
  });

  it('refuses an invalid listing id', () => {
    component.openSuppress('not-a-uuid');
    component.setAttested(true);
    component.submit();
    http.expectNone(url);
    expect(component.message).toContain('valid listing id');
  });

  it('posts a suppression with a fixed id and reloads', () => {
    component.openSuppress();
    fill();
    component.submit();
    const req = http.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      suppressionId: newId,
      listingId: listing,
      reasonCode: 'incorrect-details',
      note: 'wrong hours',
      attested: true,
    });
    req.flush({ replayed: false, sentToReview: true });
    expect(component.message).toContain('sent back to address review');
    expect(component.form).toBeNull();
    http.expectOne(url).flush(list);
  });

  it('keeps the form and its id after a failure so a retry replays', () => {
    component.openSuppress(listing);
    fill();
    component.submit();
    http.expectOne(url).flush('', { status: 503, statusText: 'x' });
    expect(component.form?.suppressionId).toBe(newId);
    component.submit();
    const retry = http.expectOne(url);
    expect(retry.request.body.suppressionId).toBe(newId);
    retry.flush('', { status: 409, statusText: 'Conflict' });
    expect(component.message).toBe(REFUSED_MESSAGE);
  });

  it('lifts a suppression with an attested reason', () => {
    component.openLift(list.suppressions[0] as never);
    component.setLiftReason('mistaken-suppression');
    component.submitLift();
    http.expectNone(`${url}/${open}/lift`);
    component.setAttested(true);
    component.submitLift();
    const req = http.expectOne(`${url}/${open}/lift`);
    expect(req.request.body).toEqual({
      reasonCode: 'mistaken-suppression',
      attested: true,
    });
    req.flush({ replayed: false });
    expect(component.message).toContain('lifted');
    http.expectOne(url).flush(list);
  });

  it('searches through the public listing route and offers identified hits', () => {
    component.search('cafe');
    const req = http.expectOne(
      (r) => r.url === searchUrl && r.params.get('q') === 'cafe'
    );
    expect(req.request.params.get('identities')).toBe('1');
    req.flush({
      listings: [
        { id: listing, name: 'Corner Cafe', category: 'food' },
        { name: 'No identity', category: 'food' },
      ],
    });
    expect(component.hits).toHaveLength(1);
    component.openSuppress(component.hits[0].id);
    expect(component.form?.listingId).toBe(listing);
  });
});
