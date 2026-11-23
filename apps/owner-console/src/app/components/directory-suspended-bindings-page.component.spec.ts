import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { OwnerConfirmService } from '@optimistic-tanuki/owner-page-ui';
import { DirectorySuspendedBindingsPageComponent } from './directory-suspended-bindings-page.component';
import {
  OwnerConfirmStub,
  createOwnerConfirmStub,
} from './owner-confirm.testing';

const base = '/api/directory/reviewed-bindings';
const listUrl = `${base}?state=suspended`;
const town = '11111111-1111-4111-8111-111111111111';
const binding = (n: number) => ({
  id: `b000000${n}-0000-4000-8000-000000000000`,
  townId: town,
  townName: 'Douglas, GA',
  listing: { scanId: `scan${n}`, sourceFileRowNumber: String(n) },
  provenance: 'reviewed',
  stateCause: 'source_changed',
  suspendedAt: '2026-11-20T00:00:00.000Z',
});

describe('DirectorySuspendedBindingsPageComponent', () => {
  let fixture: ComponentFixture<DirectorySuspendedBindingsPageComponent>;
  let component: DirectorySuspendedBindingsPageComponent;
  let http: HttpTestingController;
  let confirmStub: OwnerConfirmStub;

  beforeEach(async () => {
    confirmStub = createOwnerConfirmStub();
    await TestBed.configureTestingModule({
      imports: [
        DirectorySuspendedBindingsPageComponent,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: API_BASE_URL, useValue: '/api' },
        { provide: OwnerConfirmService, useValue: confirmStub },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DirectorySuspendedBindingsPageComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('lists suspended bindings with the total', () => {
    http
      .expectOne(listUrl)
      .flush({ bindings: [binding(1)], total: 3, nextCursor: null });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Douglas, GA');
    expect(text).toContain('scan1');
    expect(text).toContain('3 suspended in total');
  });

  it('shows the empty state', () => {
    http.expectOne(listUrl).flush({ bindings: [], total: 0, nextCursor: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'No suspended bindings.'
    );
  });

  it('shows Unavailable with Retry when the list fails', () => {
    http
      .expectOne(listUrl)
      .flush('', { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('could not be loaded');
    component.load(false);
    http.expectOne(listUrl).flush({ bindings: [], total: 0, nextCursor: null });
  });

  it('filters by town and rejects a malformed town id', () => {
    http.expectOne(listUrl).flush({ bindings: [], total: 0, nextCursor: null });
    component.townFilter = 'not-a-town';
    component.applyFilter();
    http.expectNone((r) => r.url.startsWith(base));
    expect(component.filterError()).toContain('town id');
    component.townFilter = town;
    component.applyFilter();
    http
      .expectOne(`${listUrl}&townId=${town}`)
      .flush({ bindings: [], total: 0, nextCursor: null });
  });

  it('pages with the cursor and appends', () => {
    http
      .expectOne(listUrl)
      .flush({ bindings: [binding(1)], total: 2, nextCursor: 'c1' });
    component.loadMore();
    http
      .expectOne(`${listUrl}&cursor=c1`)
      .flush({ bindings: [binding(2)], total: 2, nextCursor: null });
    expect(component.bindings().length).toBe(2);
    expect(component.nextCursor()).toBeNull();
  });

  it('revalidates after a plain confirmation, then reloads', async () => {
    http
      .expectOne(listUrl)
      .flush({ bindings: [binding(1)], total: 1, nextCursor: null });
    await component.revalidate(binding(1));
    expect(confirmStub.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'plain' })
    );
    http
      .expectOne(`${base}/${binding(1).id}/revalidate`)
      .flush({ bindingId: binding(1).id, outcome: 'active' });
    http.expectOne(listUrl).flush({ bindings: [], total: 0, nextCursor: null });
    expect(component.notice()).toContain('active');
  });

  it('does not revalidate when cancelled', async () => {
    http
      .expectOne(listUrl)
      .flush({ bindings: [binding(1)], total: 1, nextCursor: null });
    confirmStub.confirm.mockResolvedValue({ confirmed: false });
    await component.revalidate(binding(1));
    http.expectNone(`${base}/${binding(1).id}/revalidate`);
  });

  it('says when the source stage is not configured', async () => {
    http
      .expectOne(listUrl)
      .flush({ bindings: [binding(1)], total: 1, nextCursor: null });
    await component.revalidate(binding(1));
    http
      .expectOne(`${base}/${binding(1).id}/revalidate`)
      .flush('', { status: 503, statusText: 'Unavailable' });
    expect(component.actionError()).toContain('not configured');
  });
});
