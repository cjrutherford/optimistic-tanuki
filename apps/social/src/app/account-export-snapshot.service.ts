import { Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES } from '@optimistic-tanuki/constants';
import {
  AccountExportOwnerSpoolService,
  AccountExportProfileBoundSnapshotService,
  AccountExportProfileBoundSnapshotError,
} from '@optimistic-tanuki/storage';
import {
  SocialAccountExportOwnerService,
  SocialAccountExportSource,
} from './account-export-owner.service';

export { AccountExportProfileBoundSnapshotError as SocialAccountExportSnapshotError };

@Injectable()
export class SocialAccountExportSnapshotService extends AccountExportProfileBoundSnapshotService<SocialAccountExportSource> {
  constructor(
    owner: SocialAccountExportOwnerService,
    spoolService: AccountExportOwnerSpoolService,
    authClient: ClientProxy
  ) {
    super(owner, spoolService, authClient, {
      participantId: 'social',
      sources: SOCIAL_ACCOUNT_EXPORT_CAPTURE_SOURCES,
    });
  }
}
