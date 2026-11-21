import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  DirectoryRightsPageComponent,
  STALE_MESSAGE,
} from './directory-rights-page.component';

const api = 'http://localhost:3000/api/directory/rights-cases';
const vt = 'a'.repeat(64);
const vt2 = 'b'.repeat(64);
const rightsCase = {
  id: 'b52cfef1-9180-46ba-96d8-cca7149f9bdf',
  scope: 'field',
  subjectKey: 'k',
  provider: 'overture',
  releaseId: '2026-01-01.0',
  field: 'name',
  dataset: 'meta',
  license: 'CDLA',
  sourcePointer: '/properties/names/primary',
  ambiguous: false,
  reasons: ['field_terms_unconfirmed'],
  observedRows: 12,
  status: 'review',
  createdAt: '2026-11-10T00:00:00.000Z',
  updatedAt: '2026-11-10T00:00:00.000Z',
  versionToken: vt,
};
const listUrl = `${api}?status=review&limit=25&offset=0`;

describe('DirectoryRightsPageComponent', () => {
  let fixture: ComponentFixture<DirectoryRightsPageComponent>;
  let http: HttpTestingController;
  let component: DirectoryRightsPageComponent;

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
        DirectoryRightsPageComponent,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api' },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DirectoryRightsPageComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const open = () => {
    http.expectOne(listUrl).flush({ cases: [rightsCase] });
    component.toggle(rightsCase as never);
    http.expectOne(`${api}/${rightsCase.id}`).flush({
      ...rightsCase,
      history: [],
    });
    fixture.detectChanges();
  };

  it('lists cases by status and says a decision never grants display', () => {
    http.expectOne(listUrl).flush({ cases: [rightsCase] });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('name');
    expect(text).toContain('never grants public display');
    component.setStatus('all');
    http.expectOne(`${api}?limit=25&offset=0`).flush({ cases: [] });
  });

  it('requires a reason and sends the version token and a client decision id', () => {
    open();
    component.decide(rightsCase as never, 'defer', ' ', '', '');
    expect(component.message).toContain('reason is required');
    component.decide(
      rightsCase as never,
      'exclude_field',
      'owner asked',
      '',
      ''
    );
    const req = http.expectOne(`${api}/${rightsCase.id}/decisions`);
    expect(req.request.body).toMatchObject({
      action: 'exclude_field',
      expectedVersionToken: vt,
      reason: 'owner asked',
    });
    expect(req.request.body.decisionId).toMatch(/^[0-9a-f-]{36}$/);
    req.flush({ recorded: true, replayed: false, status: 'excluded' });
    http.expectOne(`${api}/${rightsCase.id}`).flush({
      ...rightsCase,
      status: 'excluded',
      versionToken: vt2,
      history: [],
    });
    expect(component.cases[0].versionToken).toBe(vt2);
  });

  it('refuses to confirm terms without an https url and a sha-256', () => {
    open();
    component.decide(
      rightsCase as never,
      'confirm_terms',
      'read',
      'http://x',
      'zz'
    );
    expect(component.message).toContain('HTTPS terms URL');
    component.decide(
      rightsCase as never,
      'confirm_terms',
      'read',
      'https://example.org/terms',
      'c'.repeat(64)
    );
    const req = http.expectOne(`${api}/${rightsCase.id}/decisions`);
    expect(req.request.body.termsUrl).toBe('https://example.org/terms');
    req.flush({ recorded: true, replayed: false, status: 'resolved' });
    http
      .expectOne(`${api}/${rightsCase.id}`)
      .flush({ ...rightsCase, history: [] });
  });

  it('shows a stale message and reloads the open case on 409', () => {
    open();
    component.decide(rightsCase as never, 'defer', 'later', '', '');
    http
      .expectOne(`${api}/${rightsCase.id}/decisions`)
      .flush(
        { code: 'stale_decision' },
        { status: 409, statusText: 'Conflict' }
      );
    expect(component.message).toBe(STALE_MESSAGE);
    http
      .expectOne(`${api}/${rightsCase.id}`)
      .flush({ ...rightsCase, versionToken: vt2, history: [] });
    expect(component.cases[0].versionToken).toBe(vt2);
  });

  it('undoes the latest decision with the case token and a reason', () => {
    open();
    component.undo(rightsCase as never, {
      entry: { id: 'e1', label: 'Defer', actor: 'a', at: 't' },
      reason: 'mistake',
    });
    const req = http.expectOne(`${api}/${rightsCase.id}/undo`);
    expect(req.request.body).toMatchObject({
      undoOf: 'e1',
      expectedVersionToken: vt,
      reason: 'mistake',
    });
    req.flush({ recorded: true, replayed: false, status: 'review' });
    http
      .expectOne(`${api}/${rightsCase.id}`)
      .flush({ ...rightsCase, history: [] });
    expect(component.undoing).toBe(false);
  });

  it('syncs a release with one id per attempt', () => {
    http.expectOne(listUrl).flush({ cases: [] });
    component.sync('not a release!');
    expect(component.message).toContain('release id');
    component.sync('2026-01-01.0');
    const req = http.expectOne(`${api}/sync`);
    expect(req.request.body.releaseId).toBe('2026-01-01.0');
    req.flush({ created: 2, existing: 1, lineages: 2 });
    expect(component.message).toContain('2 new');
    http.expectOne(listUrl).flush({ cases: [] });
  });

  it('offers only the decisions a case allows', () => {
    const c = rightsCase as never;
    expect(component.canExclude(c)).toBe(true);
    expect(component.canConfirm(c)).toBe(true);
    const ambiguous = { ...rightsCase, ambiguous: true, scope: 'source' };
    expect(component.canConfirm(ambiguous as never)).toBe(false);
    expect(component.canExclude(ambiguous as never)).toBe(false);
    expect(
      component.canReopen({ ...rightsCase, status: 'withdrawn' } as never)
    ).toBe(false);
    http.expectOne(listUrl).flush({ cases: [] });
  });
});
