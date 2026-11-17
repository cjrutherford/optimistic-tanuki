import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  DirectoryWithdrawalsPageComponent,
  POLL_MS,
} from './directory-withdrawals-page.component';

const url = 'http://localhost:3000/api/directory/withdrawals';
const record = (over: Record<string, unknown> = {}) => ({
  id: 'd0000000-0000-4000-8000-000000000001',
  kind: 'row',
  target: `${'a'.repeat(64)}:1`,
  reason: 'owner asked',
  actorId: '11111111-1111-4111-8111-111111111111',
  rightsCaseId: null,
  status: 'pending',
  attempts: 0,
  steps: 0,
  progress: {},
  lastError: null,
  requestedAt: '2026-11-10T00:00:00.000Z',
  updatedAt: '2026-11-10T00:00:00.000Z',
  completedAt: null,
  ...over,
});

describe('DirectoryWithdrawalsPageComponent', () => {
  let fixture: ComponentFixture<DirectoryWithdrawalsPageComponent>;
  let http: HttpTestingController;
  let component: DirectoryWithdrawalsPageComponent;

  beforeEach(async () => {
    jest.useFakeTimers();
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
        DirectoryWithdrawalsPageComponent,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: API_BASE_URL, useValue: 'http://localhost:3000/api' },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DirectoryWithdrawalsPageComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    jest.useRealTimers();
  });

  it('states that withdrawal is permanent', () => {
    http.expectOne(`${url}?limit=50`).flush({ requests: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('permanent');
    expect(fixture.nativeElement.textContent).toContain('no undo');
  });

  it('will not send until the exact confirmation is typed', () => {
    http.expectOne(`${url}?limit=50`).flush({ requests: [] });
    component.setTyped('withdraw');
    component.submit('t', 'because', '');
    expect(component.message).toContain('WITHDRAW');
    http.expectNone(url);
    component.setTyped('WITHDRAW');
    component.submit('', 'because', '');
    expect(component.message).toContain('required');
    http.expectNone(url);
  });

  it('sends one id per attempt and clears the confirmation after success', () => {
    http.expectOne(`${url}?limit=50`).flush({ requests: [] });
    component.setTyped('WITHDRAW');
    component.submit(' target ', ' because ', '');
    const first = http.expectOne(url);
    expect(first.request.body).toMatchObject({
      kind: 'row',
      target: 'target',
      reason: 'because',
      confirm: 'WITHDRAW',
    });
    first.error(new ProgressEvent('error'));
    component.submit('target', 'because', '');
    const retry = http.expectOne(url);
    expect(retry.request.body.id).toBe(first.request.body.id);
    retry.flush({ replayed: false, request: record() });
    expect(component.typed).toBe('');
    http.expectOne(`${url}?limit=50`).flush({ requests: [record()] });
  });

  it('refreshes itself while a request is running and stops when done', () => {
    http.expectOne(`${url}?limit=50`).flush({
      requests: [
        record({ status: 'running', progress: { rowsRemaining: 700 } }),
      ],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('700 rows remaining');
    jest.advanceTimersByTime(POLL_MS);
    http.expectOne(`${url}?limit=50`).flush({
      requests: [
        record({
          status: 'complete',
          progress: { rowsRemaining: 0 },
          completedAt: '2026-11-10T00:01:00.000Z',
        }),
      ],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('All data removed');
    jest.advanceTimersByTime(POLL_MS * 3);
    http.expectNone(`${url}?limit=50`);
  });
});
