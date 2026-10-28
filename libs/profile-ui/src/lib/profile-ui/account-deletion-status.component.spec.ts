import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { AccountDeletionStatusComponent } from './account-deletion-status.component';
import { AccountRightsApiService } from './account-rights-api.service';
const OP = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  CAP = 'private-recovery-receipt';
const response = (state = 'complete') => ({
  operationId: OP,
  appId: 'local-hub',
  state,
  canRetry: state === 'blocked',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
});
describe('U02 public deletion receipt view', () => {
  let fixture: ComponentFixture<AccountDeletionStatusComponent>,
    component: AccountDeletionStatusComponent;
  let api: {
    storedReceipt: jest.Mock;
    readDeletion: jest.Mock;
    retryDeletion: jest.Mock;
    saveReceipt: jest.Mock;
  };
  beforeEach(async () => {
    api = {
      storedReceipt: jest.fn(() => CAP),
      readDeletion: jest.fn(async () => response()),
      retryDeletion: jest.fn(async () => response('fencing')),
      saveReceipt: jest.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [AccountDeletionStatusComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { data: { appId: 'local-hub' } } },
        },
        { provide: AccountRightsApiService, useValue: api },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AccountDeletionStatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });
  afterEach(() => fixture.destroy());
  it('restores status after sign-out without depending on an AuthState service', () => {
    expect(api.readDeletion).toHaveBeenCalledWith('local-hub', CAP);
    expect(fixture.nativeElement.textContent).toContain('confirmed account');
    expect(component.status()?.state).toBe('complete');
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('h1')
    );
  });
  it('only offers retry for a blocked accepted request and reuses its receipt', async () => {
    api.readDeletion.mockResolvedValueOnce(response('blocked'));
    await component.refresh();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Retry deletion');
    await component.retry();
    expect(api.retryDeletion).toHaveBeenCalledWith('local-hub', CAP);
    expect(component.status()?.state).toBe('fencing');
  });
  it('keeps the stored request available when transport fails', async () => {
    api.readDeletion.mockRejectedValueOnce(Error('offline'));
    await component.refresh();
    expect(component.error()).toContain('Status is unavailable');
    expect(component.receipt).toBe(CAP);
  });
  it('does not replace an existing receipt when browser storage rejects a restore', async () => {
    api.saveReceipt.mockImplementationOnce(() => {
      throw Error('blocked');
    });
    component.restoreValue = 'new-receipt';
    await component.restore();
    expect(component.receipt).toBe(CAP);
    expect(component.error()).toContain('could not be saved');
  });
});
