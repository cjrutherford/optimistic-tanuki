import { SetMetadata } from '@nestjs/common';
import {
  ADMIN_API_LOOPBACK_KEY,
  ADMIN_API_PUBLIC_KEY,
} from './owner-authorization.guard';

export const AdminApiPublic = () => SetMetadata(ADMIN_API_PUBLIC_KEY, true);
export const LoopbackBootstrap = () =>
  SetMetadata(ADMIN_API_LOOPBACK_KEY, true);
