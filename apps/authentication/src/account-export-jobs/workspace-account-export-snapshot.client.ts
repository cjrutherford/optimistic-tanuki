import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  WorkspaceCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotReadResult,
  WorkspaceAccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';
import {
  AccountExportProfileBoundSnapshotClient,
  AccountExportSnapshotPullService,
  OwnerSpoolHandle,
} from '@optimistic-tanuki/storage';
import { firstValueFrom, timeout } from 'rxjs';

export interface WorkspaceAccountExportCapture {
  handle: OwnerSpoolHandle<string>;
  descriptor: WorkspaceAccountExportSnapshotDescriptor;
  cleanup(): Promise<void>;
}

export class WorkspaceAccountExportSnapshotClientError extends Error {
  constructor() {
    super('WORKSPACE_SNAPSHOT_UNAVAILABLE');
  }
}

@Injectable()
export class WorkspaceAccountExportSnapshotClient {
  private readonly shared: AccountExportProfileBoundSnapshotClient;

  constructor(
    @Inject(ServiceTokens.WORKSPACE_SERVICE)
    private readonly workspace: ClientProxy,
    pull: AccountExportSnapshotPullService
  ) {
    this.shared = new AccountExportProfileBoundSnapshotClient(pull, {
      participantId: 'workspace',
      sources: WORKSPACE_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      errorFactory: () => new WorkspaceAccountExportSnapshotClientError(),
      open: (payload, timeoutMs) =>
        this.rpc(
          WorkspaceCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
      read: (payload, timeoutMs) =>
        this.rpc<AccountExportSnapshotReadResult>(
          WorkspaceCommands.READ_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
      release: (payload, timeoutMs) =>
        this.rpc(
          WorkspaceCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
    });
  }

  capture(
    input: AccountExportCaptureGrant,
    profileInput: AccountExportSnapshotDescriptor,
    renewLease: () => Promise<boolean>
  ): Promise<WorkspaceAccountExportCapture> {
    return this.shared.capture(input, profileInput, renewLease);
  }

  private async rpc<T = unknown>(
    command: string,
    payload: unknown,
    timeoutMs: number
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.workspace
          .send<T>({ cmd: command }, payload)
          .pipe(timeout({ first: timeoutMs }))
      );
    } catch {
      throw new WorkspaceAccountExportSnapshotClientError();
    }
  }
}
