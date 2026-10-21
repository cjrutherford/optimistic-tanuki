import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import {
  AccountExportOwnerSpoolService,
  AccountExportProfileBoundSnapshotService,
} from '@optimistic-tanuki/storage';
import {
  PermissionsAccountExportOwnerService,
  PermissionsAccountExportSource,
} from './account-export-owner.service';

@Injectable()
export class PermissionsAccountExportSnapshotService extends AccountExportProfileBoundSnapshotService<PermissionsAccountExportSource> {
  constructor(
    owner: PermissionsAccountExportOwnerService,
    spoolService: AccountExportOwnerSpoolService,
    authClient: ClientProxy
  ) {
    super(owner, spoolService, authClient, {
      participantId: 'permissions',
      sources: PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES,
    });
  }
}
