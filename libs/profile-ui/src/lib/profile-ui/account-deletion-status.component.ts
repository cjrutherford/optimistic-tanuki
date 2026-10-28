import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import {
  AccountRightsApiService,
  DeletionUiStatus,
  RightsApp,
} from './account-rights-api.service';

@Component({
  selector: 'lib-account-deletion-status',
  standalone: true,
  imports: [FormsModule, ButtonComponent],
  template: `
    <section class="receipt-page" aria-labelledby="deletion-status-title">
      <h1 id="deletion-status-title" #heading tabindex="-1">
        Account deletion
      </h1>
      <p>
        This receipt tracks the account you confirmed. Signing in to a different
        account does not change this request.
      </p>
      <p role="status" aria-live="polite">{{ message() }}</p>
      @if(error()){
      <p role="alert">{{ error() }}</p>
      } @if(status(); as request){
      <p>
        Request <code>{{ request.operationId }}</code>
      </p>
      <p>
        Receipt valid until {{ expiryLabel(request.expiresAt) }}. Expiry does
        not cancel an accepted deletion.
      </p>
      } @if(receipt){
      <div class="receipt-actions">
        <otui-button variant="outlined" [disabled]="busy()" (click)="refresh()"
          >Refresh deletion status</otui-button
        >
        @if(status()?.canRetry){<otui-button
          [disabled]="busy()"
          (click)="retry()"
          >Retry deletion</otui-button
        >}
      </div>
      <p>
        This checks application-held data. Downloads, backups and external
        providers need separate verification.
      </p>
      <details>
        <summary>Save your private recovery receipt</summary>
        <p>
          Keep this private. It can check this request and retry an already
          accepted deletion; it cannot sign in or download account data.
        </p>
        <label for="deletion-receipt-copy">Recovery receipt</label>
        <textarea
          id="deletion-receipt-copy"
          [value]="receipt"
          readonly
          rows="4"
        ></textarea>
        <otui-button variant="outlined" (click)="copy()"
          >Copy recovery receipt</otui-button
        >
        <p role="status">{{ copyNotice() }}</p>
      </details>
      }
      <details [open]="!receipt">
        <summary>Restore a saved receipt</summary>
        <form (ngSubmit)="restore()">
          <label for="deletion-receipt-restore"
            >Paste your private receipt</label
          >
          <textarea
            id="deletion-receipt-restore"
            name="restoreReceipt"
            [(ngModel)]="restoreValue"
            maxlength="2048"
            rows="4"
            autocomplete="off"
          ></textarea>
          <otui-button [disabled]="busy()" (click)="restore()"
            >Check saved receipt</otui-button
          >
        </form>
      </details>
      <p>
        <a [href]="appId === 'client-interface' ? '/settings' : '/account'"
          >Back to account settings</a
        >
        · <a href="/contact">Contact support</a>
      </p>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .receipt-page {
        max-width: 48rem;
        margin: clamp(1rem, 4vw, 3rem) auto;
        padding: clamp(1rem, 4vw, 2rem);
        color: var(--foreground, currentColor);
      }
      h1:focus {
        outline: 2px solid var(--accent, currentColor);
        outline-offset: 0.3rem;
      }
      p {
        line-height: 1.6;
      }
      .receipt-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }
      details {
        margin: 1.5rem 0;
        padding: 1rem;
        border: 1px solid var(--border-color, #8886);
        border-radius: 8px;
      }
      summary {
        cursor: pointer;
        font-weight: 600;
      }
      label {
        display: block;
        margin: 0.75rem 0;
      }
      textarea {
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
        padding: 0.75rem;
        color: inherit;
        background: var(--background, transparent);
        border: 1px solid currentColor;
        border-radius: 6px;
      }
      code {
        overflow-wrap: anywhere;
      }
      @media (max-width: 480px) {
        .receipt-actions {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class AccountDeletionStatusComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  private readonly api = inject(AccountRightsApiService);
  private readonly platform = inject(PLATFORM_ID);
  readonly appId = inject(ActivatedRoute).snapshot.data['appId'] as RightsApp;
  @ViewChild('heading') heading?: ElementRef<HTMLElement>;
  readonly status = signal<DeletionUiStatus | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly copyNotice = signal('');
  receipt = '';
  restoreValue = '';
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private notAccepted = 0;
  ngOnInit() {
    if (!['client-interface', 'local-hub'].includes(this.appId))
      throw Error('Invalid account application');
    this.receipt = this.api.storedReceipt(this.appId) ?? '';
    if (this.receipt) void this.refresh();
  }
  ngAfterViewInit() {
    if (isPlatformBrowser(this.platform)) this.heading?.nativeElement.focus();
  }
  ngOnDestroy() {
    this.generation++;
    clearTimeout(this.timer);
  }
  message() {
    const request = this.status();
    if (!request)
      return this.receipt
        ? 'Checking the deletion request…'
        : 'No recovery receipt is saved in this tab. Use the tab where you confirmed deletion, or restore your saved receipt.';
    return request.state === 'complete'
      ? 'The confirmed account has been removed from application storage.'
      : request.state === 'blocked'
      ? 'Deletion needs another attempt. The confirmed account remains unavailable while cleanup is unfinished. Retry, or contact support if it stays blocked.'
      : request.state === 'not-accepted'
      ? 'No deletion has been accepted for this receipt yet. If you just confirmed, we are checking. Otherwise, return to account settings to confirm again.'
      : 'Deletion is in progress. Sign-in sessions for the confirmed account have ended. Keep your receipt to check progress later.';
  }
  expiryLabel(value: string) {
    return new Date(value).toLocaleString();
  }
  refresh() {
    return this.load(false);
  }
  retry() {
    return this.load(true);
  }
  async restore() {
    if (this.busy()) return;
    const generation = ++this.generation;
    clearTimeout(this.timer);
    this.busy.set(true);
    this.error.set('');
    try {
      const value = this.restoreValue.trim();
      const status = await this.api.readDeletion(this.appId, value);
      if (generation !== this.generation) return;
      this.api.saveReceipt(this.appId, value);
      this.receipt = value;
      this.status.set(status);
      this.notAccepted = status.state === 'not-accepted' ? 1 : 0;
      this.restoreValue = '';
    } catch {
      if (generation === this.generation)
        this.error.set(
          'That receipt could not be saved. Check its contents and browser storage settings.'
        );
    } finally {
      if (generation === this.generation) {
        this.busy.set(false);
        this.schedule();
      }
    }
  }
  async copy() {
    try {
      await navigator.clipboard.writeText(this.receipt);
      this.copyNotice.set('Receipt copied. Keep it private.');
    } catch {
      this.copyNotice.set(
        'Copy is unavailable. Select the receipt above and copy it manually.'
      );
    }
  }
  private async load(retry: boolean) {
    if (this.busy() || !this.receipt) return;
    const generation = this.generation;
    clearTimeout(this.timer);
    this.busy.set(true);
    this.error.set('');
    try {
      const status = await (retry
        ? this.api.retryDeletion(this.appId, this.receipt)
        : this.api.readDeletion(this.appId, this.receipt));
      if (generation !== this.generation) return;
      this.status.set(status);
      if (status.state === 'not-accepted') this.notAccepted++;
      else this.notAccepted = 0;
    } catch {
      if (generation === this.generation)
        this.error.set(
          'Status is unavailable. Refresh to try again. If your receipt expired, contact support; an accepted deletion continues independently.'
        );
    } finally {
      if (generation === this.generation) {
        this.busy.set(false);
        this.schedule();
      }
    }
  }
  private schedule() {
    const state = this.status()?.state;
    if (
      !this.error() &&
      (state === 'fencing' ||
        state === 'deleting' ||
        state === 'blocked' ||
        (state === 'not-accepted' && this.notAccepted < 15))
    )
      this.timer = setTimeout(
        () => void this.refresh(),
        state === 'blocked' ? 5000 : 2000
      );
  }
}
