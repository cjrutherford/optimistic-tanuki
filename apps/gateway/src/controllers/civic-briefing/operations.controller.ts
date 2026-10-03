import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CommunityCommands,
  type OfficialStanding,
  type TownDensity,
} from '@optimistic-tanuki/civic-community';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import {
  ActOnTakedownNoticeBody,
  ConfirmOfficialCallbackBody,
} from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { User, type UserDetails } from '../../decorators/user.decorator';
import { RequestTimeout } from '../../decorators/request-timeout.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { CivicContributionsClient } from './civic-contributions.client';
import {
  DensityReply,
  OfficialStandingReply,
  OutcomeSweepReply,
  PromotionExportReply,
  RereviewReply,
  TakedownActionReply,
  TakedownNoticeListReply,
} from './replies';

/** Upkeep may re-review many contributions through the review model. */
const MAINTAIN_DEADLINE_MS = 10 * 60 * 1000;

/**
 * The operator's triggers for the community service (plan slice P3.3, D24),
 * which replace the Daylight POC's operator CLI. Each is guarded by one admin
 * permission; the operator is recorded by account id on whatever they decide.
 */
@ApiTags('civic-community-operations')
@UseGuards(AuthGuard, PermissionsGuard)
@Controller(['v1/local-hub', 'local-hub'])
export class CivicOperationsController {
  private readonly civic: CivicContributionsClient;

  constructor(
    @Inject(ServiceTokens.CIVIC_CONTRIBUTIONS_SERVICE)
    contributions: ClientProxy,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE) permissions: ClientProxy
  ) {
    this.civic = new CivicContributionsClient(contributions, permissions);
  }

  /**
   * Per-town contributor density. Not public: a town's thinness is a
   * recruiting problem, not a headline, and publishing it would tell anyone
   * which town is easiest to flood. `local-hub/density` is the POC's path.
   */
  @Get(['density', 'operations/density'])
  @RequirePermissions('density.read')
  @ApiOperation({ summary: 'Per-town contributor density' })
  @ApiResponse({ status: 200, type: DensityReply })
  async density() {
    return {
      data: await this.civic.call<{ rows: TownDensity[] }>(
        CommunityCommands.Density,
        {}
      ),
    };
  }

  /** Record the operator's callback to a town, raising an official's standing. */
  @Post('operations/officials/confirm-callback')
  @HttpCode(200)
  @RequirePermissions('official.verify')
  @ApiOperation({ summary: "Confirm an official's callback" })
  @ApiResponse({ status: 200, type: OfficialStandingReply })
  async confirmCallback(
    @User() user: UserDetails,
    @Body() body: ConfirmOfficialCallbackBody
  ) {
    return {
      data: await this.civic.call<{ standing: OfficialStanding }>(
        CommunityCommands.ConfirmOfficialCallback,
        {
          userId: body.userId,
          localitySlug: body.localitySlug,
          operator: user.userId,
          note: body.note,
        }
      ),
    };
  }

  @Get('operations/takedown-notices')
  @RequirePermissions('takedown.manage')
  @ApiOperation({ summary: 'Copyright notices, optionally by state' })
  @ApiQuery({ name: 'state', required: false })
  @ApiResponse({ status: 200, type: TakedownNoticeListReply })
  async takedownNotices(@Query('state') state?: string) {
    return {
      data: await this.civic.call<unknown[]>(
        CommunityCommands.ListTakedownNotices,
        state ? { state } : {}
      ),
    };
  }

  @Post('operations/takedown-notices/:id/act')
  @HttpCode(200)
  @RequirePermissions('takedown.manage')
  @ApiOperation({ summary: 'Uphold, decline or restore after a notice' })
  @ApiResponse({ status: 200, type: TakedownActionReply })
  async actOnTakedownNotice(
    @User() user: UserDetails,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ActOnTakedownNoticeBody
  ) {
    return {
      data: await this.civic.call<{
        contributions: string[];
        suspended: string[];
      }>(CommunityCommands.ActOnTakedownNotice, {
        noticeId: id,
        action: body.action,
        operator: user.userId,
        note: body.note,
      }),
    };
  }

  @Post('operations/rereview')
  @RequestTimeout(MAINTAIN_DEADLINE_MS + 10_000)
  @HttpCode(200)
  @RequirePermissions('community.maintain')
  @ApiOperation({ summary: 'Run the re-review sweep now' })
  @ApiResponse({ status: 200, type: RereviewReply })
  async rereview() {
    return {
      data: await this.civic.call<{ changed: number }>(
        CommunityCommands.Rereview,
        {},
        MAINTAIN_DEADLINE_MS
      ),
    };
  }

  @Post('operations/outcomes/sweep')
  @RequestTimeout(MAINTAIN_DEADLINE_MS + 10_000)
  @HttpCode(200)
  @RequirePermissions('community.maintain')
  @ApiOperation({ summary: 'Compare reports against records published since' })
  @ApiResponse({ status: 200, type: OutcomeSweepReply })
  async sweepOutcomes() {
    return {
      data: await this.civic.call<unknown>(
        CommunityCommands.SweepOutcomes,
        {},
        MAINTAIN_DEADLINE_MS
      ),
    };
  }

  @Post('operations/promotions/export')
  @RequestTimeout(MAINTAIN_DEADLINE_MS + 10_000)
  @HttpCode(200)
  @RequirePermissions('community.maintain')
  @ApiOperation({ summary: 'Write the quotable-material snapshots' })
  @ApiResponse({ status: 200, type: PromotionExportReply })
  async exportPromotions() {
    return {
      data: await this.civic.call<{ towns: unknown }>(
        CommunityCommands.ExportPromotions,
        {},
        MAINTAIN_DEADLINE_MS
      ),
    };
  }
}
