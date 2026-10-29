import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  PermissionCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotReadResult,
  PermissionsAccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';
import {
  AccountExportProfileBoundSnapshotClient,
  AccountExportProfileBoundSnapshotClientOptions,
  AccountExportSnapshotPullService,
  OwnerSpoolHandle,
} from '@optimistic-tanuki/storage';
import { firstValueFrom, timeout } from 'rxjs';

export interface PermissionsAccountExportCapture {
  handle: OwnerSpoolHandle<string>;
  descriptor: PermissionsAccountExportSnapshotDescriptor;
  cleanup(): Promise<void>;
}

export class PermissionsAccountExportSnapshotClientError extends Error {
  constructor() {
    super('PERMISSIONS_SNAPSHOT_UNAVAILABLE');
  }
}

@Injectable()
export class PermissionsAccountExportSnapshotClient {
  private readonly shared: AccountExportProfileBoundSnapshotClient;

  constructor(
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly permissions: ClientProxy,
    pull: AccountExportSnapshotPullService
  ) {
    const options: AccountExportProfileBoundSnapshotClientOptions = {
      participantId: 'permissions',
      sources: PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      errorFactory: () => new PermissionsAccountExportSnapshotClientError(),
      open: (payload, timeoutMs) =>
        this.rpc(
          PermissionCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
      read: (payload, timeoutMs) =>
        this.rpc<AccountExportSnapshotReadResult>(
          PermissionCommands.READ_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
      release: (payload, timeoutMs) =>
        this.rpc(
          PermissionCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
    };
    this.shared = new AccountExportProfileBoundSnapshotClient(pull, options);
  }

  capture(
    input: AccountExportCaptureGrant,
    profileInput: AccountExportSnapshotDescriptor,
    renewLease: () => Promise<boolean>
  ): Promise<PermissionsAccountExportCapture> {
    return this.shared.capture(input, profileInput, renewLease);
  }

  private async rpc<T = unknown>(
    command: string,
    payload: unknown,
    timeoutMs: number
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.permissions
          .send<T>({ cmd: command }, payload)
          .pipe(timeout({ first: timeoutMs }))
      );
    } catch {
      throw new PermissionsAccountExportSnapshotClientError();
    }
  }
}
