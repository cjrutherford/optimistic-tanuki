import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { of } from 'rxjs';
import { OwnerConfirmService } from '@optimistic-tanuki/owner-page-ui';
import { BoundaryReviewPageComponent } from './boundary-review-page.component';
import {
  OwnerConfirmStub,
  createOwnerConfirmStub,
} from './owner-confirm.testing';

const id = '11111111-1111-4111-8111-111111111111';
describe('BoundaryReviewPageComponent', () => {
  let confirmStub: OwnerConfirmStub;
  beforeEach(async () => {
    confirmStub = createOwnerConfirmStub();
    await TestBed.configureTestingModule({
      imports: [BoundaryReviewPageComponent, HttpClientTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ communityId: id })) },
        },
        { provide: API_BASE_URL, useValue: '/api' },
        { provide: OwnerConfirmService, useValue: confirmStub },
      ],
    }).compileComponents();
  });
  it('explains an unverified candidate and shows its town context', () => {
    const fixture = TestBed.createComponent(BoundaryReviewPageComponent);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`/api/directory/towns/${id}/boundary-candidate`)
      .flush({
        candidate: {
          communityId: id,
          geoid: '1323872',
          layer: 'place',
          vintage: '2026',
          stateFips: '13',
          archiveSha256: 'a'.repeat(64),
          reviewContext: {
            name: 'Douglas, GA',
            city: 'Douglas',
            adminArea: 'GA',
            countryCode: 'US',
            localityType: 'city',
          },
        },
      });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Boundary candidate');
    expect(text).toContain('Douglas, GA');
    expect(text).toContain('1323872');
    expect(text.toLowerCase()).toContain('not verified');
    expect(text.toLowerCase()).not.toContain('approve boundary');
  });
  it('shows a pending state when no candidate exists', () => {
    const fixture = TestBed.createComponent(BoundaryReviewPageComponent);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`/api/directory/towns/${id}/boundary-candidate`)
      .flush({ candidate: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.toLowerCase()).toContain(
      'no current candidate'
    );
  });
  it('shows a service error instead of an empty result when the review service fails', () => {
    const fixture = TestBed.createComponent(BoundaryReviewPageComponent);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`/api/directory/towns/${id}/boundary-candidate`)
      .flush('', { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent.toLowerCase();
    expect(text).toContain('candidate unavailable');
    expect(text).not.toContain('no current candidate');
  });
  it('records a confirmed review against the candidate the reviewer inspected', () => {
    const fixture = TestBed.createComponent(BoundaryReviewPageComponent);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const candidate = {
      communityId: id,
      changeToken: id,
      geographyHash: 'b'.repeat(64),
      geoid: '1323872',
      layer: 'place',
      vintage: '2026',
      stateFips: '13',
      archiveSha256: 'a'.repeat(64),
      reviewContext: {
        name: 'Douglas, GA',
        city: 'Douglas',
        adminArea: 'GA',
        countryCode: 'US',
        localityType: 'city',
      },
    };
    http
      .expectOne(`/api/directory/towns/${id}/boundary-candidate`)
      .flush({ candidate });
    fixture.detectChanges();
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      value: () => id,
      configurable: true,
    });
    const component: any = fixture.componentInstance;
    component.recordDecision(
      candidate,
      'https://www.census.gov/example',
      false
    );
    http.expectNone(`/api/directory/towns/${id}/boundary-decisions`);
    component.recordDecision(candidate, 'https://www.census.gov/example', true);
    const req = http.expectOne(`/api/directory/towns/${id}/boundary-decisions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.candidate.geographyHash).toBe(
      candidate.geographyHash
    );
    expect(req.request.body.decision).toBe('verified');
    req.flush({ recorded: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Review recorded');
  });
  describe('boundary lock', () => {
    const lockUrl = `/api/directory/towns/${id}/boundary-lock`;
    const unlocked = { locked: false, townName: 'Douglas, GA', lock: null };
    const locked = {
      locked: true,
      townName: 'Douglas, GA',
      lock: {
        lockedAt: '2026-11-20T00:00:00.000Z',
        version: 1,
        geoid: '1323872',
        source: 'owner_console',
        lockedBy: id,
        reason: 'pinned',
      },
    };
    function open(state: object) {
      const fixture = TestBed.createComponent(BoundaryReviewPageComponent);
      fixture.detectChanges();
      const http = TestBed.inject(HttpTestingController);
      http
        .expectOne(`/api/directory/towns/${id}/boundary-candidate`)
        .flush({ candidate: null });
      http.expectOne(lockUrl).flush(state);
      fixture.detectChanges();
      return { fixture, http, component: fixture.componentInstance as any };
    }

    it('shows the current lock state', () => {
      const { fixture } = open(locked);
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('Locked');
      expect(text).toContain('Unlock boundary');
    });

    it('offers Retry when the lock state cannot be read', () => {
      const fixture = TestBed.createComponent(BoundaryReviewPageComponent);
      fixture.detectChanges();
      const http = TestBed.inject(HttpTestingController);
      http
        .expectOne(`/api/directory/towns/${id}/boundary-candidate`)
        .flush({ candidate: null });
      http
        .expectOne(lockUrl)
        .flush('', { status: 503, statusText: 'Unavailable' });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'lock state could not be read'
      );
      fixture.componentInstance.loadLock();
      http.expectOne(lockUrl).flush(unlocked);
    });

    it('locks only after the town name is typed, with a reason', async () => {
      const { http, component } = open(unlocked);
      component.lockReason = 'pin it';
      const pending = component.lock();
      await pending;
      expect(confirmStub.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'typed',
          typedPhrase: 'Douglas, GA',
        })
      );
      const req = http.expectOne(`${lockUrl}`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ reason: 'pin it' });
      req.flush(locked);
      http.expectOne(lockUrl).flush(locked);
    });

    it('does not lock when the typed confirmation is cancelled', async () => {
      const { http, component } = open(unlocked);
      confirmStub.confirm.mockResolvedValue({ confirmed: false });
      component.lockReason = 'pin it';
      await component.lock();
      http.expectNone(lockUrl);
    });

    it('needs a reason before it asks to lock', async () => {
      const { http, component } = open(unlocked);
      await component.lock();
      expect(confirmStub.confirm).not.toHaveBeenCalled();
      http.expectNone(lockUrl);
      expect(component.lockMessage).toContain('reason');
    });

    it('explains a town with no verified boundary', async () => {
      const { http, component } = open(unlocked);
      component.lockReason = 'pin it';
      await component.lock();
      http
        .expectOne(lockUrl)
        .flush(
          { code: 'invalid_state', detail: 'no_verified_boundary' },
          { status: 409, statusText: 'Conflict' }
        );
      expect(component.lockMessage).toContain('no verified current boundary');
      http.expectOne(lockUrl).flush(unlocked);
    });

    it('unlocks with the reason the confirmation returns', async () => {
      const { http, component } = open(locked);
      confirmStub.confirm.mockResolvedValue({
        confirmed: true,
        reason: 'wrong boundary',
      });
      await component.unlock();
      expect(confirmStub.confirm).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'reason' })
      );
      const req = http.expectOne(
        (r) => r.url === `/api/directory/towns/${id}/boundary-unlock`
      );
      expect(req.request.body).toEqual({ reason: 'wrong boundary' });
      req.flush(unlocked);
      http.expectOne(lockUrl).flush(unlocked);
    });
  });
});
