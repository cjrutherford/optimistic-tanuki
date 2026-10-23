import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES,
  AppConfigCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  AccountExportCaptureGrant,
  AccountExportSnapshotDescriptor,
  AccountExportSnapshotReadResult,
  AppConfiguratorAccountExportSnapshotDescriptor,
} from '@optimistic-tanuki/models';
import {
  AccountExportProfileBoundSnapshotClient,
  AccountExportSnapshotPullService,
  OwnerSpoolHandle,
} from '@optimistic-tanuki/storage';
import { firstValueFrom, timeout } from 'rxjs';

export interface AppConfiguratorAccountExportCapture {
  handle: OwnerSpoolHandle<string>;
  descriptor: AppConfiguratorAccountExportSnapshotDescriptor;
  cleanup(): Promise<void>;
}

export class AppConfiguratorAccountExportSnapshotClientError extends Error {
  constructor() {
    super('APP_CONFIGURATOR_SNAPSHOT_UNAVAILABLE');
  }
}

@Injectable()
export class AppConfiguratorAccountExportSnapshotClient {
  private readonly shared: AccountExportProfileBoundSnapshotClient;

  constructor(
    @Inject(ServiceTokens.APP_CONFIGURATOR_SERVICE)
    private readonly appConfigurator: ClientProxy,
    pull: AccountExportSnapshotPullService
  ) {
    this.shared = new AccountExportProfileBoundSnapshotClient(pull, {
      participantId: 'app-configurator',
      sources: APP_CONFIGURATOR_ACCOUNT_EXPORT_CAPTURE_SOURCES,
      errorFactory: () => new AppConfiguratorAccountExportSnapshotClientError(),
      open: (payload, timeoutMs) =>
        this.rpc(
          AppConfigCommands.OPEN_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
      read: (payload, timeoutMs) =>
        this.rpc<AccountExportSnapshotReadResult>(
          AppConfigCommands.READ_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
      release: (payload, timeoutMs) =>
        this.rpc(
          AppConfigCommands.RELEASE_ACCOUNT_EXPORT_CAPTURE,
          payload,
          timeoutMs
        ),
    });
  }

  capture(
    input: AccountExportCaptureGrant,
    profileInput: AccountExportSnapshotDescriptor,
    renewLease: () => Promise<boolean>
  ): Promise<AppConfiguratorAccountExportCapture> {
    return this.shared.capture(input, profileInput, renewLease);
  }

  private async rpc<T = unknown>(
    command: string,
    payload: unknown,
    timeoutMs: number
  ): Promise<T> {
    try {
      return await firstValueFrom(
        this.appConfigurator
          .send<T>({ cmd: command }, payload)
          .pipe(timeout({ first: timeoutMs }))
      );
    } catch {
      throw new AppConfiguratorAccountExportSnapshotClientError();
    }
  }
}
