import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  inject,
  signal,
  Output,
  EventEmitter,
} from '@angular/core';
import { ButtonComponent, ModalComponent } from '@optimistic-tanuki/common-ui';
import { FormsModule } from '@angular/forms';
import {
  AccountRightsApiService,
  ExportUiStatus,
  RightsApp,
  newAccountOperationKey,
} from './account-rights-api.service';

@Component({
  selector: 'lib-account-rights',
  standalone: true,
  imports: [ButtonComponent, ModalComponent, FormsModule],
  template: `
    <section class="account-rights" aria-labelledby="account-rights-title">
      <h2 id="account-rights-title">Your account data</h2>
      <p>
        Download your data from Optimistic Tanuki, Towne Square and their shared
        services. Other people’s private details are excluded.
      </p>
      <p class="account-label">
        Signed in as {{ accountLabel || 'your current account' }}
      </p>
      <div class="rights-actions">
        <otui-button
          [disabled]="busy() || !accountId || active()"
          (click)="createExport()"
          >Request export</otui-button
        >
        <otui-button
          variant="outlined"
          [disabled]="busy() || !accountId"
          (click)="refresh()"
          >Refresh export status</otui-button
        >
      </div>
      <p role="status" aria-live="polite">{{ statusText() }}</p>
      @if(error()) {
      <p class="rights-error" role="alert">{{ error() }}</p>
      } @if(job(); as exportJob) { @if(exportJob.downloadUrl) {
      <otui-button [disabled]="busy()" (click)="download()"
        >Download archive</otui-button
      >
      <p>
        You must stay signed in to download. If the archive expires, request a
        new export.
      </p>
      } @if(exportJob.state === 'failed' || exportJob.state === 'incomplete') {
      <otui-button
        variant="outlined"
        [disabled]="busy()"
        (click)="exportAction('retry')"
        >Retry export</otui-button
      >
      } @if(active()) {
      <otui-button
        variant="outlined"
        [disabled]="busy()"
        (click)="exportAction('cancel')"
        >Cancel export</otui-button
      >
      } }
      <hr />
      <h3>Delete your account</h3>
      <p>
        Remove your account and its data in Optimistic Tanuki, Towne Square and
        their shared services. This cannot be undone.
      </p>
      <otui-button
        variant="danger"
        [disabled]="busy() || deleting() || !accountId"
        (click)="openDeletion()"
        >Delete account</otui-button
      >
      <a class="saved-receipt" href="/account-deletion"
        >Check a deletion request</a
      >
    </section>
    <otui-modal
      [visible]="confirmDeletion()"
      heading="Delete this account?"
      ariaDescribedBy="account-deletion-consequences"
      [closable]="!deleting()"
      [closeOnEscape]="!deleting()"
      [closeOnBackdrop]="!deleting()"
      (close)="closeDeletion()"
    >
      <p>
        <strong>{{ accountLabel || 'The current signed-in account' }}</strong>
        will lose access in both applications when this request is accepted.
      </p>
      <p>
        Your posts, messages, media and other account data will be removed.
        Other people’s content remains, and shared audit history loses your
        identifying fields.
      </p>
      <p>
        Copies you downloaded, backups and provider-held information need
        separate verification. This control does not promise removal from those
        locations.
      </p>
      <p>
        Deletion cannot be undone. Keep your recovery receipt to check progress
        after sign-out.
      </p>
      <form (ngSubmit)="beginDeletion()">
        <label for="account-deletion-confirmation"
          >Type DELETE to confirm</label
        >
        <input
          id="account-deletion-confirmation"
          name="deletionConfirmation"
          [(ngModel)]="deletionConfirmation"
          autocomplete="off"
          [disabled]="deleting()"
        />
      </form>
      @if(deletionError()) {
      <p role="alert">{{ deletionError() }}</p>
      } @if(deleting()) {
      <p role="status">Saving your recovery receipt and sending the request…</p>
      }
      <div modal-footer class="rights-actions">
        <otui-button
          variant="outlined"
          [disabled]="deleting()"
          (click)="closeDeletion()"
          >Keep account</otui-button
        >
        <otui-button
          variant="danger"
          [disabled]="deleting() || deletionConfirmation !== 'DELETE'"
          (click)="beginDeletion()"
          >Permanently delete account</otui-button
        >
      </div>
    </otui-modal>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .account-rights {
        padding: clamp(1rem, 3vw, 1.5rem);
        border: 1px solid var(--border-color, #8886);
        border-radius: var(--border-radius, 12px);
        color: var(--foreground, currentColor);
        background: var(--background, transparent);
      }
      h2 {
        margin-top: 0;
      }
      p {
        line-height: 1.6;
        max-width: 65ch;
      }
      .account-label {
        font-weight: 600;
      }
      .rights-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      otui-button {
        max-width: 100%;
      }
      .rights-error {
        color: var(--danger, #b42318);
      }
      @media (max-width: 480px) {
        .rights-actions {
          flex-direction: column;
          align-items: stretch;
        }
      }
    `,
  ],
})
export class AccountRightsComponent implements OnChanges, OnDestroy {
  @Input() accountId = '';
  @Input() accountLabel = '';
  @Input() appId: RightsApp = 'client-interface';
  @Output() deletionReceiptReady = new EventEmitter<void>();
  readonly job = signal<ExportUiStatus | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly confirmDeletion = signal(false);
  readonly deleting = signal(false);
  readonly deletionError = signal('');
  deletionConfirmation = '';
  private deletionAccount = '';
  private deletionKey = '';
  private readonly api = inject(AccountRightsApiService);
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private createKey = '';
  ngOnChanges() {
    this.generation++;
    clearTimeout(this.timer);
    this.job.set(null);
    this.error.set('');
    this.busy.set(false);
    this.createKey = '';
    this.confirmDeletion.set(false);
    this.deleting.set(false);
    this.deletionConfirmation = '';
    this.deletionError.set('');
    this.deletionAccount = '';
    this.deletionKey = '';
    if (this.accountId) void this.refresh();
  }
  ngOnDestroy() {
    this.generation++;
    clearTimeout(this.timer);
    this.job.set(null);
    this.accountId = '';
    this.accountLabel = '';
    this.deletionAccount = '';
    this.deletionKey = '';
    this.createKey = '';
  }
  active() {
    return this.job()?.state === 'running' || this.job()?.state === 'queued';
  }
  openDeletion() {
    if (this.busy() || !this.accountId) return;
    this.deletionAccount = this.accountId;
    this.deletionConfirmation = '';
    this.deletionError.set('');
    this.confirmDeletion.set(true);
  }
  closeDeletion() {
    if (this.deleting()) return;
    this.confirmDeletion.set(false);
    this.deletionConfirmation = '';
    this.deletionError.set('');
  }
  async beginDeletion() {
    if (
      this.deleting() ||
      !this.confirmDeletion() ||
      this.deletionConfirmation !== 'DELETE' ||
      this.deletionAccount !== this.accountId
    )
      return;
    const generation = this.generation,
      account = this.accountId,
      app = this.appId;
    this.deleting.set(true);
    this.deletionError.set('');
    try {
      if (!this.deletionKey) this.deletionKey = newAccountOperationKey();
      const prepared = await this.api.prepareDeletion(
        account,
        app,
        this.deletionKey
      );
      if (generation !== this.generation) return;
      try {
        this.api.savePreparedReceipt(account, app, prepared.receipt);
      } catch {
        this.deletionError.set(
          'This browser could not save your recovery receipt. Enable browser storage or use another browser before deleting.'
        );
        return;
      }
      // Dispatch acceptance only after durable receipt storage. The destination is public
      // and can recover an unknown response without the soon-to-be-revoked session.
      const acceptance = this.api.acceptDeletion(
        account,
        app,
        prepared.receipt
      );
      this.confirmDeletion.set(false);
      this.deletionConfirmation = '';
      this.deletionReceiptReady.emit();
      await acceptance.catch(() => undefined);
    } catch {
      if (generation === this.generation)
        this.deletionError.set(
          'Deletion could not be started. Refresh your account or check a previously saved request.'
        );
    } finally {
      if (generation === this.generation) this.deleting.set(false);
    }
  }
  statusText() {
    const job = this.job();
    if (!job && this.error()) return 'Export status could not be checked.';
    if (!job)
      return this.busy() ? 'Checking your export…' : 'No export requested.';
    return job.downloadUrl
      ? 'Your export is ready to download.'
      : this.active()
      ? 'Preparing your export. You can leave this page and return later.'
      : job.state === 'complete'
      ? 'This export is no longer available. You can request another.'
      : 'Your export is not ready. Retry or request another export.';
  }
  refresh() {
    return this.perform(() =>
      this.job()
        ? this.api.get(this.accountId, this.appId, this.job()!.jobId)
        : this.api.latest(this.accountId, this.appId)
    );
  }
  createExport() {
    try {
      if (!this.createKey) this.createKey = newAccountOperationKey();
    } catch {
      this.error.set(
        'A secure browser connection is needed to request an export.'
      );
      return Promise.resolve();
    }
    return this.perform(
      () => this.api.create(this.accountId, this.appId, this.createKey),
      true
    );
  }
  exportAction(action: 'retry' | 'cancel') {
    const job = this.job();
    if (job)
      return this.perform(() =>
        this.api.action(this.accountId, this.appId, job.jobId, action)
      );
    return Promise.resolve();
  }
  async download() {
    const url = this.job()?.downloadUrl;
    if (!url || this.busy()) return;
    const generation = this.generation;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.checkDownload(url, this.appId);
      if (generation === this.generation) window.location.assign(url);
    } catch {
      if (generation === this.generation) {
        this.error.set(
          'The archive could not be downloaded. Refresh its status or sign in again.'
        );
        this.job.update((job) => (job ? { ...job, downloadUrl: null } : job));
      }
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  private async perform(
    load: () => Promise<ExportUiStatus | null>,
    created = false
  ) {
    if (!this.accountId || this.busy()) return;
    const generation = this.generation,
      account = this.accountId,
      app = this.appId;
    this.busy.set(true);
    this.error.set('');
    clearTimeout(this.timer);
    try {
      const job = await load();
      if (generation !== this.generation) return;
      if (
        job &&
        (job.accountId !== account ||
          job.appId !== app ||
          !['queued', 'running', 'failed', 'incomplete', 'complete'].includes(
            job.state
          ) ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            job.jobId
          ))
      )
        throw Error('Invalid account export');
      const path = job
        ? '/api/authentication/account-export/' + job.jobId + '/download'
        : null;
      if (
        job?.downloadUrl &&
        (job.state !== 'complete' || job.downloadUrl !== path)
      )
        throw Error('Invalid account export');
      this.job.set(job);
      if (created) this.createKey = '';
    } catch (error) {
      if (generation === this.generation) {
        this.job.update((job) => (job ? { ...job, downloadUrl: null } : job));
        const status = (error as { status?: number }).status;
        this.error.set(
          status === 401
            ? 'Sign in again to manage your export.'
            : status === 409
            ? 'Your account or export changed. Refresh before continuing.'
            : 'Export status is unavailable. Try again.'
        );
      }
    } finally {
      if (generation === this.generation) {
        this.busy.set(false);
        if (this.active() && !this.error())
          this.timer = setTimeout(() => void this.refresh(), 2000);
      }
    }
  }
}
