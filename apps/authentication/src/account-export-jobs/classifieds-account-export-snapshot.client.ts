import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  CLASSIFIEDS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  ClassifiedCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotReadResult,
  ClassifiedsAccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';
import {
  AccountExportProfileBoundSnapshotClient,
  AccountExportSnapshotPullService,
  OwnerSpoolHandle,
} from '@optimistic-tanuki/storage';
import { firstValueFrom, timeout } from 'rxjs';

export interface ClassifiedsAccountExportCapture {
  handle: OwnerSpoolHandle<string>;
  descriptor: ClassifiedsAccountExportSnapshotDescriptor;
  cleanup(): Promise<void>;
}

export class ClassifiedsAccountExportSnapshotClientError extends Error {
  constructor() {
    super('CLASSIFIEDS_SNAPSHOT_UNAVAILABLE');
  }
}

@Injectable()
export class ClassifiedsAccountExportSnapshotClient {
  private readonly shared: AccountExportProfileBoundSnapshotClient;

  constructor(
    @Inject(ServiceTokens.CLASSIFIEDS_SERVICE)
    private readonly classifieds: ClientProxy,
    pull: AccountExportSnapshotPullService
  ) {
    this.shared = new AccountExportProfileBoundSnapshotClient(pull, {
      participantId: 'classifieds',
      sources: CLASSIFIEDS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      errorFactory: () => new ClassifiedsAccountExportSnapshotClientError(),
      open: (payload, timeoutMs) =>
        this.rpc(
          ClassifiedCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
      read: (payload, timeoutMs) =>
        this.rpc<AccountExportSnapshotReadResult>(
          ClassifiedCommands.READ_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
      release: (payload, timeoutMs) =>
        this.rpc(
          ClassifiedCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
    });
  }

  capture(
    input: AccountExportCaptureGrant,
    profileInput: AccountExportSnapshotDescriptor,
    renewLease: () => Promise<boolean>
  ): Promise<ClassifiedsAccountExportCapture> {
    return this.shared.capture(input, profileInput, renewLease);
  }

  private async rpc<T = unknown>(
    command: string,
    payload: unknown,
    timeoutMs: number
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.classifieds
          .send<T>({ cmd: command }, payload)
          .pipe(timeout({ first: timeoutMs }))
      );
    } catch {
      throw new ClassifiedsAccountExportSnapshotClientError();
    }
  }
}
