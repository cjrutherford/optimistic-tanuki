import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  PaymentCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotReadResult,
} from '@optimistic-tanuki/models';
import {
  AccountExportProfileBoundSnapshotClient,
  AccountExportSnapshotPullService,
  OwnerSpoolHandle,
} from '@optimistic-tanuki/storage';
import { firstValueFrom, timeout } from 'rxjs';

export interface PaymentsAccountExportCapture {
  handle: OwnerSpoolHandle<string>;
  descriptor: AccountExportSnapshotDescriptor;
  cleanup(): Promise<void>;
}

export class PaymentsAccountExportSnapshotClientError extends Error {
  constructor() {
    super('PAYMENTS_SNAPSHOT_UNAVAILABLE');
  }
}

@Injectable()
export class PaymentsAccountExportSnapshotClient {
  private readonly shared: AccountExportProfileBoundSnapshotClient;

  constructor(
    @Inject(ServiceTokens.PAYMENTS_SERVICE)
    private readonly payments: ClientProxy,
    pull: AccountExportSnapshotPullService
  ) {
    this.shared = new AccountExportProfileBoundSnapshotClient(pull, {
      participantId: 'payments',
      sources: PAYMENTS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      errorFactory: () => new PaymentsAccountExportSnapshotClientError(),
      open: (payload, timeoutMs) =>
        this.rpc(
          PaymentCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
      read: (payload, timeoutMs) =>
        this.rpc<AccountExportSnapshotReadResult>(
          PaymentCommands.READ_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
      release: (payload, timeoutMs) =>
        this.rpc(
          PaymentCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
    });
  }

  capture(
    input: AccountExportCaptureGrant,
    profileInput: AccountExportSnapshotDescriptor,
    renewLease: () => Promise<boolean>
  ): Promise<PaymentsAccountExportCapture> {
    return this.shared.capture(input, profileInput, renewLease);
  }

  private async rpc<T = unknown>(
    command: string,
    payload: unknown,
    timeoutMs: number
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.payments
          .send<T>({ cmd: command }, payload)
          .pipe(timeout({ first: timeoutMs }))
      );
    } catch {
      throw new PaymentsAccountExportSnapshotClientError();
    }
  }
}
