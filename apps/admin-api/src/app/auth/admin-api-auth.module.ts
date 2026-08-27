import { Module } from '@nestjs/common';
import { OwnerAuthorizationGuard } from './owner-authorization.guard';
import {
  OwnerAuthorizationService,
  OWNER_AUTHORIZATION_FETCH,
} from './owner-authorization.service';

@Module({
  providers: [
    {
      provide: OWNER_AUTHORIZATION_FETCH,
      useValue: fetch,
    },
    OwnerAuthorizationService,
    OwnerAuthorizationGuard,
  ],
  exports: [OwnerAuthorizationService, OwnerAuthorizationGuard],
})
export class AdminApiAuthModule {}
