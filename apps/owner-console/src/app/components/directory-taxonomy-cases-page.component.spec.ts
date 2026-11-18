import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  DirectoryTaxonomyCasesPageComponent,
  TAXONOMY_STALE_MESSAGE,
} from './directory-taxonomy-cases-page.component';

const api = 'http://localhost:3000/api/directory/taxonomy/cases';
const vt = 'a'.repeat(64);
const vt2 = 'b'.repeat(64);
const taxonomyCase = {
  id: 'b52cfef1-9180-46ba-96d8-cca7149f9bdf',
  townId: 'c52cfef1-9180-46ba-96d8-cca7149f9bdf',
  listingId: 'e52cfef1-9180-46ba-96d8-cca7149f9bdf',
  reason: 'operator_raised',
  name: 'Corner Diner',
  observedCategory: 'restaurant',
  status: 'open',
  assignedCategoryId: null,
  assignedPlaceTypeId: null,
  createdAt: '2026-11-10T00:00:00.000Z',
  updatedAt: '2026-11-10T00:00:00.000Z',
  versionToken: vt,
};
const listUrl = `${api}?status=open&limit=25&offset=0`;

describe('DirectoryTaxonomyCasesPageComponent', () => {
  let fixture: ComponentFixture<DirectoryTaxonomyCasesPageComponent>;
  let http: HttpTestingController;
  let component: DirectoryTaxonomyCasesPageComponent;

  beforeEach(async () => {
    let n = 0;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        randomUUID: () =>
          `d0000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      },
    });
    await TestBed.configureTestingModule({
      imports: [
        DirectoryTaxonomyCasesPageComponent,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api' },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DirectoryTaxonomyCasesPageComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  const open = () => {
    http.expectOne(listUrl).flush({ cases: [taxonomyCase] });
    component.toggle(component.cases[0]);
    http
      .expectOne(`${api}/${taxonomyCase.id}`)
      .flush({ ...taxonomyCase, history: [] });
    fixture.detectChanges();
  };

  it('lists the queue and offers every category except adult', () => {
    http.expectOne(listUrl).flush({ cases: [taxonomyCase] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Corner Diner');
    expect(component.categories.map((c) => c.id)).not.toContain('adult');
    expect(component.categories.map((c) => c.id)).toContain('services');
    expect(fixture.nativeElement.textContent).toContain('cannot be assigned');
  });

  it('requires a reason and a category before sending an assignment', () => {
    open();
    component.decide(component.cases[0], 'assign', ' ', 'services');
    expect(component.message).toContain('reason');
    component.decide(component.cases[0], 'assign', 'because', '');
    expect(component.message).toContain('Choose the category');
    http.expectNone(`${api}/${taxonomyCase.id}/decisions`);
  });

  it('assigns with a place type and reuses the id across a retry', () => {
    open();
    const c = component.cases[0];
    component.decide(c, 'assign', ' fix ', 'services', 'radio_station');
    const first = http.expectOne(`${api}/${taxonomyCase.id}/decisions`);
    expect(first.request.body).toMatchObject({
      action: 'assign',
      reason: 'fix',
      categoryId: 'services',
      placeTypeId: 'radio_station',
      expectedVersionToken: vt,
    });
    first.error(new ProgressEvent('error'));
    component.decide(c, 'assign', 'fix', 'services', 'radio_station');
    const retry = http.expectOne(`${api}/${taxonomyCase.id}/decisions`);
    expect(retry.request.body.decisionId).toBe(first.request.body.decisionId);
    retry.flush({ recorded: true, replayed: false, status: 'assigned' });
    http.expectOne(`${api}/${taxonomyCase.id}`).flush({
      ...taxonomyCase,
      status: 'assigned',
      assignedCategoryId: 'services',
      versionToken: vt2,
      history: [],
    });
    expect(component.cases[0].status).toBe('assigned');
    expect(component.cases[0].versionToken).toBe(vt2);
  });

  it('reloads the case when a decision loses a race', () => {
    open();
    component.decide(component.cases[0], 'defer', 'later');
    http
      .expectOne(`${api}/${taxonomyCase.id}/decisions`)
      .flush(
        { code: 'stale_decision' },
        { status: 409, statusText: 'Conflict' }
      );
    expect(component.message).toBe(TAXONOMY_STALE_MESSAGE);
    http
      .expectOne(`${api}/${taxonomyCase.id}`)
      .flush({ ...taxonomyCase, versionToken: vt2, history: [] });
  });

  it('dismisses with a required reason and reports a stale token', () => {
    open();
    const c = component.cases[0];
    component.dismiss(c, ' ');
    expect(component.message).toContain('reason');
    http.expectNone(`${api}/${taxonomyCase.id}/dismiss`);
    component.dismiss(c, ' not a problem ');
    const req = http.expectOne(`${api}/${taxonomyCase.id}/dismiss`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({
      reason: 'not a problem',
      expectedVersionToken: vt,
    });
    req.flush(
      { code: 'stale_decision' },
      { status: 409, statusText: 'Conflict' }
    );
    expect(component.message).toBe(TAXONOMY_STALE_MESSAGE);
    http
      .expectOne(`${api}/${taxonomyCase.id}`)
      .flush({ ...taxonomyCase, versionToken: vt2, history: [] });
  });

  it('undoes through the history with the current version token', () => {
    open();
    component.undo(component.cases[0], {
      entry: { id: 'x1', label: 'Assign Services' } as never,
      reason: 'wrong',
    });
    const req = http.expectOne(`${api}/${taxonomyCase.id}/undo`);
    expect(req.request.body).toMatchObject({
      undoOf: 'x1',
      reason: 'wrong',
      expectedVersionToken: vt,
    });
    req.flush({ recorded: true, replayed: false, status: 'open' });
    http
      .expectOne(`${api}/${taxonomyCase.id}`)
      .flush({ ...taxonomyCase, history: [] });
  });

  it('raises a case once per attempt', () => {
    http.expectOne(listUrl).flush({ cases: [] });
    component.raise('', 'l', 'r');
    expect(component.message).toContain('required');
    component.raise('t', 'l', 'r');
    const req = http.expectOne(api);
    expect(req.request.body).toMatchObject({
      townId: 't',
      listingId: 'l',
      reason: 'r',
    });
    req.flush({ replayed: false, case: taxonomyCase });
    http.expectOne(listUrl).flush({ cases: [taxonomyCase] });
    expect(component.message).toBe('Case raised.');
  });
});
