import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AccountRightsComponent } from './account-rights.component';
import { AccountRightsApiService } from './account-rights-api.service';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  JOB = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const status = (state = 'running', accountId = A) => ({
  jobId: JOB,
  accountId,
  appId: 'client-interface',
  state,
  downloadUrl: null,
});
describe('U01 shared account export state', () => {
  let fixture: ComponentFixture<AccountRightsComponent>,
    component: AccountRightsComponent;
  let api: {
    latest: jest.Mock;
    create: jest.Mock;
    get: jest.Mock;
    action: jest.Mock;
    checkDownload: jest.Mock;
    prepareDeletion: jest.Mock;
    savePreparedReceipt: jest.Mock;
    acceptDeletion: jest.Mock;
  };
  beforeEach(async () => {
    api = {
      latest: jest.fn(async () => null),
      create: jest.fn(async () => status()),
      get: jest.fn(async () => status()),
      action: jest.fn(async () => status()),
      checkDownload: jest.fn(async () => {}),
      prepareDeletion: jest.fn(async () => ({
        receipt: 'private-test-receipt',
      })),
      savePreparedReceipt: jest.fn(),
      acceptDeletion: jest.fn(async () => ({ state: 'fencing' })),
    };
    await TestBed.configureTestingModule({
      imports: [AccountRightsComponent],
      providers: [{ provide: AccountRightsApiService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(AccountRightsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('accountId', A);
    fixture.detectChanges();
    await fixture.whenStable();
  });
  afterEach(() => fixture.destroy());
  it('restores the current scoped job and renders status through a live region', () => {
    expect(api.latest).toHaveBeenCalledWith(A, 'client-interface');
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
    expect(component.statusText()).toBe('No export requested.');
  });
  it('holds an idempotency key across a failed create and never claims completion', async () => {
    api.create.mockRejectedValueOnce({ status: 503 });
    await component.createExport();
    expect(component.error()).toBeTruthy();
    await component.createExport();
    expect(api.create.mock.calls[0][2]).toBe(api.create.mock.calls[1][2]);
    expect(component.statusText()).toContain('Preparing');
    expect(component.job()?.downloadUrl).toBeNull();
  });
  it('ignores account A completion while account B is loading', async () => {
    let finishA!: (value: any) => void, finishB!: (value: any) => void;
    api.create.mockImplementationOnce(
      () => new Promise((resolve) => (finishA = resolve))
    );
    const pending = component.createExport();
    api.latest.mockImplementationOnce(
      () => new Promise((resolve) => (finishB = resolve))
    );
    fixture.componentRef.setInput('accountId', B);
    fixture.detectChanges();
    finishA({
      ...status('complete'),
      downloadUrl: `/api/authentication/account-export/${JOB}/download`,
    });
    await pending;
    expect(component.job()).toBeNull();
    expect(component.busy()).toBe(true);
    finishB(null);
    await Promise.resolve();
    await Promise.resolve();
  });
  it('rejects foreign and incomplete artifact responses', async () => {
    for (const response of [
      { ...status(), accountId: B },
      {
        ...status(),
        downloadUrl: `/api/authentication/account-export/${JOB}/download`,
      },
      {
        ...status('complete'),
        downloadUrl: 'https://attacker.example/archive',
      },
    ]) {
      api.create.mockResolvedValueOnce(response);
      await component.createExport();
      expect(component.error()).toBeTruthy();
      expect(component.job()).toBeNull();
    }
  });
  it('revokes a stale ready link when download authorization fails', async () => {
    component.job.set({
      ...status('complete'),
      downloadUrl: `/api/authentication/account-export/${JOB}/download`,
    } as never);
    api.checkDownload.mockRejectedValueOnce({ status: 401 });
    await component.download();
    expect(component.job()?.downloadUrl).toBeNull();
    expect(component.error()).toContain('could not be downloaded');
  });
  it('discards responses after destruction', async () => {
    let finish!: (value: any) => void;
    api.create.mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve))
    );
    const pending = component.createExport();
    component.ngOnDestroy();
    finish(status());
    await pending;
    expect(component.job()).toBeNull();
  });

  it('requires exact confirmation and keeps cancellation reversible', async () => {
    component.openDeletion();
    component.deletionConfirmation = 'delete';
    await component.beginDeletion();
    expect(api.prepareDeletion).not.toHaveBeenCalled();
    component.closeDeletion();
    expect(component.confirmDeletion()).toBe(false);
  });

  it('saves the recovery receipt before acceptance and hands off before awaiting the response', async () => {
    const order: string[] = [];
    let finish!: (value: unknown) => void;
    api.savePreparedReceipt.mockImplementation(() => order.push('save'));
    api.acceptDeletion.mockImplementation(() => {
      order.push('accept');
      return new Promise((resolve) => (finish = resolve));
    });
    component.deletionReceiptReady.subscribe(() => order.push('route'));
    component.openDeletion();
    component.deletionConfirmation = 'DELETE';
    const pending = component.beginDeletion();
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(['save', 'accept', 'route']);
    finish({ state: 'fencing' });
    await pending;
  });

  it('does not accept deletion if receipt storage fails', async () => {
    api.savePreparedReceipt.mockImplementation(() => {
      throw Error('storage blocked');
    });
    component.openDeletion();
    component.deletionConfirmation = 'DELETE';
    await component.beginDeletion();
    expect(api.acceptDeletion).not.toHaveBeenCalled();
    expect(component.deletionError()).toContain('recovery receipt');
    expect(component.deleting()).toBe(false);
  });

  it('does not save or accept an old account preparation after switching accounts', async () => {
    let finish!: (value: unknown) => void;
    api.prepareDeletion.mockImplementation(
      () => new Promise((resolve) => (finish = resolve))
    );
    component.openDeletion();
    component.deletionConfirmation = 'DELETE';
    const pending = component.beginDeletion();
    fixture.componentRef.setInput('accountId', B);
    fixture.detectChanges();
    finish({ receipt: 'old-account-receipt' });
    await pending;
    expect(api.savePreparedReceipt).not.toHaveBeenCalled();
    expect(api.acceptDeletion).not.toHaveBeenCalled();
    expect(component.confirmDeletion()).toBe(false);
  });
});
