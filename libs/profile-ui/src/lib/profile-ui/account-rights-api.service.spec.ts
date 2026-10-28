import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { AccountRightsApiService } from './account-rights-api.service';
const ACCOUNT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  OP = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const APP = 'local-hub';
const receipt = (app = APP) =>
  btoa(
    JSON.stringify({
      v: 1,
      operationId: OP,
      appId: app,
      expiresAt: Date.now() + 86400000,
    })
  )
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_') +
  '.' +
  'a'.repeat(64);
describe('U01/U02 browser transport and receipt custody', () => {
  let api: AccountRightsApiService, http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(AccountRightsApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.removeItem('ot:deletion-receipt:local-hub');
    sessionStorage.removeItem('ot:deletion-receipt:client-interface');
  });
  const status = (state = 'fencing') => ({
    operationId: OP,
    appId: APP,
    state,
    canRetry: state === 'blocked',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  it('uses current-account cookie requests and explicit app scope without browser-readable tokens', async () => {
    const pending = api.latest(ACCOUNT, APP),
      request = http.expectOne(
        '/api/authentication/account-export?accountId=' + ACCOUNT
      );
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('x-ot-appscope')).toBe(APP);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ job: null });
    expect(await pending).toBeNull();
  });
  it('keeps receipt credentials in headers and preserves the prepared receipt across reload', async () => {
    const cap = receipt();
    api.savePreparedReceipt(ACCOUNT, APP, cap);
    expect(api.storedReceipt(APP)).toBe(cap);
    const pending = api.readDeletion(APP, cap),
      request = http.expectOne('/api/authentication/account-deletion/status');
    expect(request.request.urlWithParams).not.toContain(cap);
    expect(request.request.headers.get('x-ot-deletion-receipt')).toBe(cap);
    request.flush(status('not-accepted'));
    await pending;
  });
  it('does not dispatch acceptance if browser receipt storage fails or the app is wrong', () => {
    const save = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementationOnce(() => {
        throw Error('blocked');
      });
    try {
      expect(() => api.savePreparedReceipt(ACCOUNT, APP, receipt())).toThrow(
        'blocked'
      );
    } finally {
      save.mockRestore();
    }
    expect(() =>
      api.savePreparedReceipt(ACCOUNT, 'client-interface', receipt())
    ).toThrow('Invalid receipt');
    http.expectNone('/api/authentication/account-deletion/accept');
  });
  it('announces accepted account state only after the public view reads it', async () => {
    const cap = receipt(),
      events: string[] = [];
    const handler = (event: Event) =>
      events.push((event as CustomEvent).detail);
    window.addEventListener('ot:account-deleted', handler);
    try {
      api.savePreparedReceipt(ACCOUNT, APP, cap);
      const accepted = api.acceptDeletion(ACCOUNT, APP, cap);
      http
        .expectOne('/api/authentication/account-deletion/accept')
        .flush(status());
      await accepted;
      expect(events).toEqual([]);
      const observed = api.readDeletion(APP, cap);
      http
        .expectOne('/api/authentication/account-deletion/status')
        .flush(status());
      await observed;
      expect(events).toEqual([ACCOUNT]);
    } finally {
      window.removeEventListener('ot:account-deleted', handler);
    }
  });
  it('clears transient account handoff on account switch but keeps the minimal receipt', async () => {
    const cap = receipt(),
      handler = jest.fn();
    window.addEventListener('ot:account-deleted', handler);
    try {
      api.savePreparedReceipt(ACCOUNT, APP, cap);
      window.dispatchEvent(new Event('ot:session-reset'));
      const observed = api.readDeletion(APP, cap);
      http
        .expectOne('/api/authentication/account-deletion/status')
        .flush(status('complete'));
      await observed;
      expect(handler).not.toHaveBeenCalled();
      expect(api.storedReceipt(APP)).toBe(cap);
    } finally {
      window.removeEventListener('ot:account-deleted', handler);
    }
  });
  it('cannot replace a receipt status with an unrelated operation', async () => {
    const cap = receipt(),
      pending = api.readDeletion(APP, cap);
    http
      .expectOne('/api/authentication/account-deletion/status')
      .flush({ ...status('complete'), operationId: ACCOUNT });
    await expect(pending).rejects.toThrow('Invalid deletion status');
  });
});
