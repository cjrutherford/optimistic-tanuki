import { Controller, Get, Header, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { DirectoryOwnerScopeGuard } from '../directory/directory.controller';
import {
  AttentionReport,
  OwnerAttentionService,
} from './owner-attention.service';
import { OwnerHealthService, ServiceHealth } from './owner-health.service';

type RequestUser = { user?: { userId?: string; profileId?: string } };

/**
 * Owner Console home: what needs attention, and whether the stack is up.
 * AuthGuard checks the session and (for the owner-console scope) the owner
 * role; the scope guard rejects any other app scope.
 */
@Controller('owner')
@UseGuards(AuthGuard, DirectoryOwnerScopeGuard)
export class OwnerController {
  constructor(
    private readonly attention: OwnerAttentionService,
    private readonly health: OwnerHealthService
  ) {}

  @Get('attention')
  @Header('Cache-Control', 'no-store')
  getAttention(@Req() req: RequestUser): Promise<AttentionReport> {
    return this.attention.collect({
      userId: req.user?.userId,
      profileId: req.user?.profileId,
    });
  }

  @Get('health')
  @Header('Cache-Control', 'no-store')
  getHealth(): Promise<ServiceHealth[]> {
    return this.health.check();
  }
}
