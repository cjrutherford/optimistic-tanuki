import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CommunityCommands,
  type OfficialStanding,
  type TownDensity,
} from '@optimistic-tanuki/civic-community';
import {
  CivicBriefingCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  AcceptOfficialCandidateBody,
  ActOnTakedownNoticeBody,
  BackfillRequest,
  type BackfillStatus,
  ConfirmOfficialCallbackBody,
  type OfficialCandidate,
  type PipelineHealthReport,
} from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { User, type UserDetails } from '../../decorators/user.decorator';
import { RequestTimeout } from '../../decorators/request-timeout.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { CivicContributionsClient } from './civic-contributions.client';
import {
  BackfillStatusReply,
  DensityReply,
  OfficialCandidateListReply,
  OfficialCandidateReply,
  OfficialStandingReply,
  OutcomeSweepReply,
  PipelineHealthReply,
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
    @Inject(ServiceTokens.PERMISSIONS_SERVICE) permissions: ClientProxy,
    @Inject(ServiceTokens.CIVIC_BRIEFING_SERVICE)
    private readonly briefings: ClientProxy
  ) {
    this.civic = new CivicContributionsClient(contributions, permissions);
  }

  /**
   * Each town's latest pipeline run and the sources that are failing or have
   * gone quiet (P5.2). The same problems are emailed to DAYLIGHT_ALERT_EMAIL.
   */
  @Get('operations/pipeline-health')
  @RequirePermissions('town.configure')
  @ApiOperation({ summary: "Daylight's pipeline health" })
  @ApiResponse({ status: 200, type: PipelineHealthReply })
  async pipelineHealth() {
    try {
      return {
        data: await firstValueFrom(
          this.briefings
            .send<PipelineHealthReport>(
              { cmd: CivicBriefingCommands.PIPELINE_HEALTH },
              {}
            )
            // The report walks every town's sources; give it time.
            .pipe(timeout(30_000))
        ),
      };
    } catch {
      throw new ServiceUnavailableException(
        'Pipeline health is unavailable right now. Try again shortly.'
      );
    }
  }

  /**
   * Pulls towns' sources and backfills their past editions (D31), in the
   * background: answers at once with the backfill's status. One runs at a
   * time; a request while one runs gets that one's status.
   */
  @Post('operations/backfill')
  @HttpCode(202)
  @RequirePermissions('town.configure')
  @ApiOperation({ summary: 'Pull and backfill Daylight editions' })
  @ApiResponse({ status: 202, type: BackfillStatusReply })
  async startBackfill(@Body() body: BackfillRequest) {
    return {
      data: await this.briefingCall<BackfillStatus>(
        CivicBriefingCommands.BACKFILL_START,
        { towns: body.towns, days: body.days }
      ),
    };
  }

  @Get('operations/backfill')
  @RequirePermissions('town.configure')
  @ApiOperation({ summary: "The latest backfill's progress" })
  @ApiResponse({ status: 200, type: BackfillStatusReply })
  async backfillStatus() {
    return {
      data: await this.briefingCall<BackfillStatus>(
        CivicBriefingCommands.BACKFILL_STATUS,
        {}
      ),
    };
  }

  /**
   * Names Civic Core read from agendas, for the operator to accept into a
   * town's officials roster or reject (D33). Pending ones unless a status is
   * given.
   */
  @Get('operations/official-candidates')
  @RequirePermissions('town.configure')
  @ApiOperation({
    summary: 'Official candidates from agendas, pending by default',
  })
  @ApiQuery({ name: 'slug', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'accepted', 'rejected'],
  })
  @ApiResponse({ status: 200, type: OfficialCandidateListReply })
  async officialCandidates(
    @Query('slug') slug?: string,
    @Query('status') status?: string
  ) {
    return {
      data: await this.candidateCall<OfficialCandidate[]>(
        CivicBriefingCommands.OFFICIAL_CANDIDATES,
        {
          ...(slug ? { slug } : {}),
          ...(status ? { status } : {}),
        }
      ),
    };
  }

  @Post('operations/official-candidates/:id/accept')
  @HttpCode(200)
  @RequirePermissions('town.configure')
  @ApiOperation({ summary: "Add a candidate to the town's officials roster" })
  @ApiResponse({ status: 200, type: OfficialCandidateReply })
  @ApiResponse({ status: 400, description: 'A value was refused' })
  @ApiResponse({ status: 404, description: 'No such candidate' })
  async acceptOfficialCandidate(
    @User() user: UserDetails,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AcceptOfficialCandidateBody
  ) {
    return {
      data: await this.candidateCall<OfficialCandidate | null>(
        CivicBriefingCommands.ACCEPT_OFFICIAL_CANDIDATE,
        {
          id,
          office: body.office,
          source: body.source,
          decidedBy: user.userId,
          ...(body.domains ? { domains: body.domains } : {}),
          ...(body.callbackNumberSource
            ? { callbackNumberSource: body.callbackNumberSource }
            : {}),
        },
        id
      ),
    };
  }

  @Post('operations/official-candidates/:id/reject')
  @HttpCode(200)
  @RequirePermissions('town.configure')
  @ApiOperation({ summary: 'Reject a candidate; it is not suggested again' })
  @ApiResponse({ status: 200, type: OfficialCandidateReply })
  @ApiResponse({ status: 404, description: 'No such candidate' })
  async rejectOfficialCandidate(
    @User() user: UserDetails,
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    return {
      data: await this.candidateCall<OfficialCandidate | null>(
        CivicBriefingCommands.REJECT_OFFICIAL_CANDIDATE,
        { id, decidedBy: user.userId },
        id
      ),
    };
  }

  /** A refused value is the operator's to fix (400); an unknown id is 404; anything else is the service being away. */
  private async candidateCall<T>(
    cmd: string,
    payload: object,
    candidateId?: string
  ): Promise<NonNullable<T>> {
    let reply: T;
    try {
      reply = await firstValueFrom(
        this.briefings.send<T>({ cmd }, payload).pipe(timeout(10_000))
      );
    } catch (error) {
      const failure = error as { status?: number; message?: string };
      if (failure?.status === 400)
        throw new BadRequestException(failure.message);
      throw new ServiceUnavailableException(
        'The briefing service is unavailable right now. Try again shortly.'
      );
    }
    if (reply === null || reply === undefined) {
      if (candidateId)
        throw new NotFoundException(`No official candidate ${candidateId}.`);
      return [] as NonNullable<T>;
    }
    return reply as NonNullable<T>;
  }

  private async briefingCall<T>(cmd: string, payload: object): Promise<T> {
    try {
      return await firstValueFrom(
        this.briefings.send<T>({ cmd }, payload).pipe(timeout(10_000))
      );
    } catch {
      throw new ServiceUnavailableException(
        'The briefing service is unavailable right now. Try again shortly.'
      );
    }
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
