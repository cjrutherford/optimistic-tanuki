import { DestroyRef, inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom, timeout } from 'rxjs';
import { notifyAccountDeletion } from '@optimistic-tanuki/common-ui';

export type RightsApp = 'client-interface' | 'local-hub';
export interface ExportUiStatus {
  jobId: string;
  accountId: string;
  appId: RightsApp;
  state: 'queued' | 'running' | 'incomplete' | 'failed' | 'complete';
  downloadUrl: string | null;
}
export interface DeletionUiStatus {
  operationId: string;
  appId: RightsApp;
  state: 'not-accepted' | 'fencing' | 'deleting' | 'blocked' | 'complete';
  canRetry: boolean;
  expiresAt: string;
}
@Injectable({ providedIn: 'root' })
export class AccountRightsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/authentication/account-export';
  private readonly deletionBase = '/api/authentication/account-deletion';
  private handoff?: { receipt: string; accountId: string; app: RightsApp };
  constructor() {
    const clear = () => {
      this.handoff = undefined;
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('ot:session-reset', clear);
      inject(DestroyRef).onDestroy(() =>
        window.removeEventListener('ot:session-reset', clear)
      );
    }
  }
  private options(app: RightsApp) {
    return {
      withCredentials: true,
      headers: new HttpHeaders({ 'x-ot-appscope': app }),
    };
  }
  latest(accountId: string, app: RightsApp) {
    return boundedRequest(
      this.http.get<{ job: ExportUiStatus | null }>(this.base, {
        ...this.options(app),
        params: { accountId },
      })
    ).then((response) => response.job);
  }
  create(accountId: string, app: RightsApp, key: string) {
    return boundedRequest(
      this.http.post<ExportUiStatus>(
        this.base,
        { accountId, idempotencyKey: key },
        this.options(app)
      )
    );
  }
  get(accountId: string, app: RightsApp, jobId: string) {
    return boundedRequest(
      this.http.get<ExportUiStatus>(
        `${this.base}/${encodeURIComponent(jobId)}`,
        { ...this.options(app), params: { accountId } }
      )
    );
  }
  action(
    accountId: string,
    app: RightsApp,
    jobId: string,
    action: 'retry' | 'cancel'
  ) {
    return boundedRequest(
      this.http.post<ExportUiStatus>(
        `${this.base}/${encodeURIComponent(jobId)}/${action}`,
        { accountId },
        this.options(app)
      )
    );
  }
  async checkDownload(url: string, app: RightsApp): Promise<void> {
    if (
      !/^\/api\/authentication\/account-export\/[0-9a-f-]{36}\/download$/i.test(
        url
      )
    )
      throw Error('Invalid download');
    await boundedRequest(this.http.head(url, this.options(app)));
  }

  prepareDeletion(accountId: string, app: RightsApp, key: string) {
    const prior = this.storedReceipt(app);
    return boundedRequest(
      this.http.post<{ receipt: string }>(
        this.deletionBase + '/prepare',
        {
          accountId,
          idempotencyKey: key,
          ...(prior ? { priorReceipt: prior } : {}),
        },
        this.options(app)
      )
    );
  }
  savePreparedReceipt(
    accountId: string,
    app: RightsApp,
    receipt: string
  ): void {
    this.saveReceipt(app, receipt);
    this.handoff = { receipt, accountId, app };
  }
  saveReceipt(app: RightsApp, receipt: string): void {
    if (
      receipt.length > 2048 ||
      !/^[-A-Za-z0-9_]+\.[0-9a-f]{64}$/.test(receipt)
    )
      throw Error('Invalid deletion receipt');
    if (!['client-interface', 'local-hub'].includes(app))
      throw Error('Invalid account application');
    this.receiptPayload(receipt, app);
    const key = 'ot:deletion-receipt:' + app;
    sessionStorage.setItem(key, receipt);
    if (sessionStorage.getItem(key) !== receipt)
      throw Error('Receipt not saved');
  }
  storedReceipt(app: RightsApp): string | null {
    try {
      return sessionStorage.getItem('ot:deletion-receipt:' + app);
    } catch {
      return null;
    }
  }
  acceptDeletion(accountId: string, app: RightsApp, receipt: string) {
    return boundedRequest(
      this.http.post<DeletionUiStatus>(
        this.deletionBase + '/accept',
        { accountId, receipt, confirmation: 'delete-account' },
        this.options(app)
      )
    ).then((value) => this.deletionStatus(value, app, receipt, false));
  }
  readDeletion(app: RightsApp, receipt: string) {
    this.receiptPayload(receipt, app);
    return boundedRequest(
      this.http.get<DeletionUiStatus>(this.deletionBase + '/status', {
        ...this.options(app),
        headers: this.options(app).headers.set(
          'x-ot-deletion-receipt',
          receipt
        ),
      })
    ).then((value) => this.deletionStatus(value, app, receipt));
  }
  retryDeletion(app: RightsApp, receipt: string) {
    this.receiptPayload(receipt, app);
    return boundedRequest(
      this.http.post<DeletionUiStatus>(
        this.deletionBase + '/retry',
        {},
        {
          ...this.options(app),
          headers: this.options(app).headers.set(
            'x-ot-deletion-receipt',
            receipt
          ),
        }
      )
    ).then((value) => this.deletionStatus(value, app, receipt));
  }
  private receiptPayload(
    receipt: string,
    app: RightsApp
  ): { operationId: string } {
    if (
      typeof receipt !== 'string' ||
      receipt.length > 2048 ||
      !/^[-A-Za-z0-9_]+\.[0-9a-f]{64}$/.test(receipt)
    )
      throw Error('Invalid receipt');
    const encoded = receipt.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    const value = JSON.parse(
      atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='))
    ) as { operationId: string; appId: string; v: number; expiresAt: number };
    if (
      value.v !== 1 ||
      value.appId !== app ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value.operationId
      ) ||
      !Number.isFinite(value.expiresAt)
    )
      throw Error('Invalid receipt');
    return value;
  }
  private deletionStatus(
    value: DeletionUiStatus,
    app: RightsApp,
    receipt: string,
    announce = true
  ): DeletionUiStatus {
    const binding = this.receiptPayload(receipt, app);
    if (
      !value ||
      value.appId !== app ||
      value.operationId !== binding.operationId ||
      !['not-accepted', 'fencing', 'deleting', 'blocked', 'complete'].includes(
        value.state
      ) ||
      value.canRetry !== (value.state === 'blocked') ||
      !Number.isFinite(Date.parse(value.expiresAt))
    )
      throw Error('Invalid deletion status');
    if (
      announce &&
      value.state !== 'not-accepted' &&
      this.handoff?.receipt === receipt &&
      this.handoff.app === app
    ) {
      const account = this.handoff.accountId;
      this.handoff = undefined;
      notifyAccountDeletion(account);
    }
    return value;
  }
}

/** Secure UUIDv4 for request idempotency, including browsers without randomUUID. */
export function newAccountOperationKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function')
    return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function boundedRequest<T>(source: Observable<T>): Promise<T> {
  return firstValueFrom(source.pipe(timeout(20000)));
}
