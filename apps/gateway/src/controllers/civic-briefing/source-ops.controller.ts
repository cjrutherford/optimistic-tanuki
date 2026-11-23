import {
  BadRequestException,
  Body,
  ConflictException,
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
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CivicBriefingCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  ClearSourceOverrideBody,
  DecideSourceRequestBody,
  SetSourceOverrideBody,
  type SourceDecisionPage,
  type SourceHealthReport,
  type SourceOverride,
  type SourceRequestEntry,
  type SourceRequestPage,
} from '@optimistic-tanuki/models';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { User, type UserDetails } from '../../decorators/user.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import {
  SourceDecisionPageReply,
  SourceHealthReply,
  SourceOverrideListReply,
  SourceOverrideReply,
  SourceRequestDecisionReply,
  SourceRequestPageReply,
} from './replies';

/** Parses a page bound from the query string; absent or not a whole number is left out. */
function whole(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0)
    throw new BadRequestException('limit and offset must be whole numbers.');
  return parsed;
}

/**
 * The sources admin for Daylight operators (SD.6, D14, D26): the decision
 * log, overrides on what discovery adopts, per-source health and readers'
 * requests for sources. Reads need `sources.read`; changes need
 * `sources.manage`, a reason, and are recorded against the
 * operator's account id.
 */
@ApiTags('civic-community-operations')
@UseGuards(AuthGuard, PermissionsGuard)
@Controller(['v1/local-hub/operations', 'local-hub/operations'])
export class SourceOpsController {
  constructor(
    @Inject(ServiceTokens.CIVIC_BRIEFING_SERVICE)
    private readonly briefings: ClientProxy
  ) {}

  @Get('sources/:slug/decisions')
  @RequirePermissions('sources.read')
  @ApiOperation({
    summary: "A town's source decisions, newest first, paged",
  })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiResponse({ status: 200, type: SourceDecisionPageReply })
  async decisions(
    @Param('slug') slug: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return {
      data: await this.call<SourceDecisionPage>(
        CivicBriefingCommands.SOURCE_DECISIONS,
        { slug, limit: whole(limit), offset: whole(offset) }
      ),
    };
  }

  @Get('sources/:slug/overrides')
  @RequirePermissions('sources.read')
  @ApiOperation({ summary: "A town's source overrides in force" })
  @ApiResponse({ status: 200, type: SourceOverrideListReply })
  async overrides(@Param('slug') slug: string) {
    return {
      data: await this.call<SourceOverride[]>(
        CivicBriefingCommands.SOURCE_OVERRIDES,
        { slug }
      ),
    };
  }

  @Post('sources/:slug/overrides')
  @HttpCode(200)
  @RequirePermissions('sources.manage')
  @ApiOperation({ summary: 'Block a source, or pin it, with a reason' })
  @ApiResponse({ status: 200, type: SourceOverrideReply })
  @ApiResponse({ status: 400, description: 'A value was refused' })
  @ApiResponse({ status: 404, description: 'Unknown town' })
  async setOverride(
    @User() user: UserDetails,
    @Param('slug') slug: string,
    @Body() body: SetSourceOverrideBody
  ) {
    return {
      data: await this.call<SourceOverride | null>(
        CivicBriefingCommands.SOURCE_OVERRIDE_SET,
        {
          slug,
          sourceKey: body.sourceKey,
          kind: body.kind,
          reason: body.reason,
          actor: user.userId,
        },
        `No town ${slug}.`
      ),
    };
  }

  @Post('sources/:slug/overrides/:sourceKey/clear')
  @HttpCode(200)
  @RequirePermissions('sources.manage')
  @ApiOperation({ summary: "Clear a source's override, with a reason" })
  @ApiResponse({ status: 200, type: SourceOverrideReply })
  @ApiResponse({ status: 400, description: 'A value was refused' })
  @ApiResponse({ status: 404, description: 'No override on that source' })
  async clearOverride(
    @User() user: UserDetails,
    @Param('slug') slug: string,
    @Param('sourceKey') sourceKey: string,
    @Body() body: ClearSourceOverrideBody
  ) {
    return {
      data: await this.call<SourceOverride | null>(
        CivicBriefingCommands.SOURCE_OVERRIDE_CLEAR,
        { sourceKey, reason: body.reason, actor: user.userId },
        `No override on ${sourceKey} in ${slug}.`
      ),
    };
  }

  @Get('sources/:slug/health')
  @RequirePermissions('sources.read')
  @ApiOperation({ summary: "How each of a town's sources is doing" })
  @ApiResponse({ status: 200, type: SourceHealthReply })
  @ApiResponse({ status: 404, description: 'Unknown town' })
  async health(@Param('slug') slug: string) {
    return {
      data: await this.call<SourceHealthReport | null>(
        CivicBriefingCommands.SOURCE_HEALTH,
        { slug },
        `No town ${slug}.`
      ),
    };
  }

  @Get('source-requests')
  @RequirePermissions('sources.read')
  @ApiOperation({
    summary: "Readers' requests for sources, pending by default",
  })
  @ApiQuery({ name: 'slug', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'approved', 'rejected'],
  })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiResponse({ status: 200, type: SourceRequestPageReply })
  async requests(
    @Query('slug') slug?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return {
      data: await this.call<SourceRequestPage>(
        CivicBriefingCommands.SOURCE_REQUESTS,
        {
          ...(slug ? { slug } : {}),
          ...(status ? { status } : {}),
          limit: whole(limit),
          offset: whole(offset),
        }
      ),
    };
  }

  @Post('source-requests/:id/decide')
  @HttpCode(200)
  @RequirePermissions('sources.manage')
  @ApiOperation({
    summary: 'Approve or reject a source request, with a reason',
  })
  @ApiResponse({ status: 200, type: SourceRequestDecisionReply })
  @ApiResponse({ status: 400, description: 'A value was refused' })
  @ApiResponse({ status: 404, description: 'No such request' })
  @ApiResponse({ status: 409, description: 'Already decided' })
  async decide(
    @User() user: UserDetails,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: DecideSourceRequestBody
  ) {
    return {
      data: await this.call<SourceRequestEntry | null>(
        CivicBriefingCommands.SOURCE_REQUEST_DECIDE,
        {
          id,
          decision: body.decision,
          reason: body.reason,
          actor: user.userId,
        },
        `No source request ${id}.`
      ),
    };
  }

  /**
   * A refused value is the operator's to fix (400), a decided request is 409,
   * a null reply is 404 when `missing` says what was not found, and anything
   * else is the service being away: never an empty or zero answer.
   */
  private async call<T>(
    cmd: string,
    payload: object,
    missing?: string
  ): Promise<NonNullable<T>> {
    let reply: T;
    try {
      reply = await firstValueFrom(
        this.briefings.send<T>({ cmd }, payload).pipe(timeout(30_000))
      );
    } catch (error) {
      const failure = error as { status?: number; message?: string };
      if (failure?.status === 400)
        throw new BadRequestException(failure.message);
      if (failure?.status === 409) throw new ConflictException(failure.message);
      throw new ServiceUnavailableException(
        'Sources are unavailable right now. Try again shortly.'
      );
    }
    if (reply === null || reply === undefined) {
      if (missing) throw new NotFoundException(missing);
      throw new ServiceUnavailableException(
        'Sources are unavailable right now. Try again shortly.'
      );
    }
    return reply as NonNullable<T>;
  }
}
