import { Module } from '@nestjs/common';
import { OwnerAuthorizationGuard } from './owner-authorization.guard';
import { OwnerAuthorizationService } from './owner-authorization.service';

@Module({
  providers: [OwnerAuthorizationService, OwnerAuthorizationGuard],
  exports: [OwnerAuthorizationGuard],
})
export class AdminApiAuthModule {}
