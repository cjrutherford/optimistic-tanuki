import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  AssetCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotReadResult,
  AssetsAccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';
import {
  AccountExportProfileBoundSnapshotClient,
  AccountExportSnapshotPullService,
  OwnerSpoolHandle,
} from '@optimistic-tanuki/storage';
import { firstValueFrom, timeout } from 'rxjs';

export const ASSETS_CAPTURE_SOURCES = ASSETS_ACCOUNT_EXPORT_CAPTURE_SOURCES;

export interface AssetsAccountExportCapture {
  handle: OwnerSpoolHandle<string>;
  descriptor: AssetsAccountExportSnapshotDescriptor;
  cleanup(): Promise<void>;
}

export class AssetsAccountExportSnapshotClientError extends Error {
  constructor() {
    super('ASSETS_SNAPSHOT_UNAVAILABLE');
  }
}

@Injectable()
export class AssetsAccountExportSnapshotClient {
  private readonly shared: AccountExportProfileBoundSnapshotClient;
  // Retain the historical injected dependency property used by existing callers/tests.
  private readonly pull: AccountExportSnapshotPullService;

  constructor(
    @Inject(ServiceTokens.ASSETS_SERVICE) private readonly assets: ClientProxy,
    pull: AccountExportSnapshotPullService
  ) {
    this.pull = pull;
    this.shared = new AccountExportProfileBoundSnapshotClient(pull, {
      participantId: 'assets',
      sources: ASSETS_CAPTURE_SOURCES,
      errorFactory: () => new AssetsAccountExportSnapshotClientError(),
      open: (payload, timeoutMs) =>
        this.rpc(AssetCommands.OPEN_ACCOUNT_EXPORT_CAPTURE, payload, timeoutMs),
      read: (payload, timeoutMs) =>
        this.rpc<AccountExportSnapshotReadResult>(
          AssetCommands.READ_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
      release: (payload, timeoutMs) =>
        this.rpc(
          AssetCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
    });
  }

  capture(
    input: AccountExportCaptureGrant,
    profileInput: AccountExportSnapshotDescriptor,
    renewLease: () => Promise<boolean>
  ): Promise<AssetsAccountExportCapture> {
    return this.shared.capture(input, profileInput, renewLease);
  }

  private async rpc<T = unknown>(
    command: string,
    payload: unknown,
    timeoutMs: number
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.assets
          .send<T>({ cmd: command }, payload)
          .pipe(timeout({ first: timeoutMs }))
      );
    } catch {
      throw new AssetsAccountExportSnapshotClientError();
    }
  }
}
