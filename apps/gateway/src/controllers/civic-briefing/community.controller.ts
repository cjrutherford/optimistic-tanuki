import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Request, Response } from 'express';
import { firstValueFrom, timeout } from 'rxjs';
import {
  CommunityCommands,
  type CommunitySurface,
  type ContributionView,
  type ContributorPageView,
  type OfficialApplicationResult,
  type SubjectOption,
  type SubmitResult,
} from '@optimistic-tanuki/civic-community';
import { ProfileCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import {
  ContributorSignUpRequest,
  CounterNoticeBody,
  OfficialApplicationRequest,
  SubmissionRequest,
  TakedownNoticeBody,
} from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';
import { Public } from '../../decorators/public.decorator';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { User, type UserDetails } from '../../decorators/user.decorator';
import { RequestTimeout } from '../../decorators/request-timeout.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { CivicContributionsClient } from './civic-contributions.client';
import { originOf } from './origin';
import {
  CommunitySurfaceReply,
  ContributionListReply,
  ContributionReply,
  ContributionUpload,
  ContributorPageReply,
  CounterNoticeReply,
  MembershipReply,
  OfficialApplicationReply,
  SubjectOptionsReply,
  TakedownNoticeReceiptReply,
} from './replies';

/**
 * A submission waits on the virus scan and the review model, each bounded in
 * the service (30 and 90 seconds by default). The gateway must outlast both:
 * giving up first would tell the contributor it failed while the service
 * recorded it, and a retry would submit it twice.
 */
const SUBMIT_DEADLINE_MS = 180_000;

/** The largest attachment; the service holds the same limit. */
const MAX_UPLOAD_BYTES = (() => {
  const parsed = Number(process.env['MAX_UPLOAD_BYTES']);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 20 * 1024 * 1024;
})();

/** Copyright notices are public, so they are rate limited per client. */
const NOTICE_THROTTLE = { long: { limit: 5, ttl: 10 * 60 * 1000 } };

/**
 * Community intake and the community surface (plan slice P3.3), ported from
 * the Daylight POC. Nothing submitted here is published directly: a
 * contribution is reviewed, recorded, and shown to its contributor with every
 * reason. Every call that takes an actor carries the account's local-hub
 * roles (D23); if they cannot be read the answer is 503.
 *
 * A submission is multipart form data: a `submission` field holding the JSON
 * body, and an optional `attachment` file. The attachment's size is bounded
 * here; what it is, and whether it is clean, is decided by the service.
 */
@ApiTags('civic-community')
@UseGuards(AuthGuard, PermissionsGuard)
@Controller(['v1/local-hub', 'local-hub'])
export class CivicCommunityController {
  private readonly civic: CivicContributionsClient;

  constructor(
    @Inject(ServiceTokens.CIVIC_CONTRIBUTIONS_SERVICE)
    contributions: ClientProxy,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE) permissions: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profiles: ClientProxy,
    private readonly permissionsCache: PermissionsCacheService
  ) {
    this.civic = new CivicContributionsClient(contributions, permissions);
  }

  /** The signed-in account's standing in local-hub: its roles and what they allow. */
  @Get('me')
  @ApiOperation({ summary: "The account's local-hub standing" })
  @ApiResponse({ status: 200, type: MembershipReply })
  async me(@User() user: UserDetails) {
    const access = await this.civic.access(user.profileId);
    return {
      data: {
        profileId: user.profileId,
        handle: user.name,
        emailVerified: user.emailVerified === true,
        ...access,
      },
    };
  }

  /** What a contribution in this town can attach to: recent meetings and current stories. */
  @Get('editions/:slug/subjects')
  @RequirePermissions('contribution.create')
  @ApiOperation({
    summary: 'Meetings and stories a contribution can attach to',
  })
  @ApiResponse({ status: 200, type: SubjectOptionsReply })
  async subjects(@Param('slug') slug: string) {
    return {
      data: await this.civic.call<SubjectOption[]>(CommunityCommands.Subjects, {
        localitySlug: slug,
      }),
    };
  }

  @Post('contributions')
  // Outlast the service's own scan and review deadlines.
  @RequestTimeout(SUBMIT_DEADLINE_MS + 10_000)
  @RequirePermissions('contribution.create')
  @UseInterceptors(
    FileInterceptor('attachment', {
      limits: {
        fileSize: MAX_UPLOAD_BYTES,
        files: 1,
        fields: 4,
        fieldSize: 64 * 1024,
      },
    })
  )
  @ApiOperation({ summary: 'Submit an account or artifact for review' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ContributionUpload })
  @ApiHeader({
    name: 'idempotency-key',
    required: false,
    description: 'Resending with the same key returns the first submission',
  })
  @ApiResponse({ status: 201, type: ContributionReply })
  async submit(
    @User() user: UserDetails,
    @Body('submission') raw: string | undefined,
    @UploadedFile()
    attachment: { originalname: string; buffer: Buffer } | undefined,
    @Req() request: Request,
    @Headers('idempotency-key') idempotencyKey?: string
  ) {
    if (
      idempotencyKey !== undefined &&
      !/^[A-Za-z0-9_-]{8,64}$/u.test(idempotencyKey)
    ) {
      throw new BadRequestException(
        'An Idempotency-Key must be 8 to 64 letters, digits, dashes or underscores.'
      );
    }
    const submission = await parseSubmission(raw);
    const { actor, permissions } = await this.civic.actor(user);
    if (attachment && !permissions.includes('artifact.upload')) {
      throw new ForbiddenException('Your account may not attach files.');
    }
    const key = process.env['CIVIC_FINGERPRINT_KEY'];
    const result = await this.civic.call<SubmitResult>(
      CommunityCommands.Submit,
      {
        actor,
        localitySlug: submission.localitySlug,
        kind: submission.kind,
        subject: {
          kind: submission.subject.kind,
          ref: submission.subject.ref ?? null,
          text: submission.subject.text,
        },
        occurredOn: submission.occurredOn ?? null,
        body: submission.body,
        links: submission.links,
        disclosedInterest: submission.disclosedInterest ?? null,
        representations: { ...submission.representations },
        attachment: attachment
          ? {
              name: attachment.originalname.slice(0, 255),
              base64: attachment.buffer.toString('base64'),
            }
          : null,
        idempotencyKey: idempotencyKey ?? null,
        // Without a key the hashes could be reversed by trying addresses, so
        // no origin is sent rather than a weak one.
        origin: key
          ? originOf(key, request.ip, request.headers['user-agent'])
          : null,
        emailVerified: user.emailVerified === true,
      },
      SUBMIT_DEADLINE_MS
    );
    if ('refused' in result) {
      throw new UnprocessableEntityException({
        code: 'REFUSED',
        stage: result.refused.stage,
        reasons: result.refused.reasons,
        message: result.refused.reasons.join(' '),
      });
    }
    return { data: result.contribution };
  }

  @Get('contributions/mine')
  @RequirePermissions('contribution.read')
  @ApiOperation({ summary: "The account's own contributions" })
  @ApiResponse({ status: 200, type: ContributionListReply })
  async mine(@User() user: UserDetails) {
    const { actor } = await this.civic.actor(user);
    return {
      data: await this.civic.call<ContributionView[]>(CommunityCommands.Mine, {
        actor,
      }),
    };
  }

  @Post('contributions/:id/withdraw')
  @HttpCode(200)
  @RequirePermissions('contribution.withdraw')
  @ApiOperation({ summary: "Withdraw one's own contribution" })
  @ApiResponse({ status: 200, type: ContributionReply })
  async withdraw(
    @User() user: UserDetails,
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    const { actor } = await this.civic.actor(user);
    const view = await this.civic.call<ContributionView | null>(
      CommunityCommands.Withdraw,
      { actor, id }
    );
    if (!view) {
      throw new NotFoundException('That is not one of your contributions.');
    }
    return { data: view };
  }

  @Post('contributions/:id/counter-notice')
  @ApiOperation({
    summary: 'Counter a copyright notice against a contribution',
  })
  @ApiResponse({ status: 201, type: CounterNoticeReply })
  async counterNotice(
    @User() user: UserDetails,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CounterNoticeBody
  ) {
    const { actor } = await this.civic.actor(user);
    return {
      data: await this.civic.call<{ id: string }>(
        CommunityCommands.FileCounterNotice,
        { actor, contributionId: id, ...body }
      ),
    };
  }

  /**
   * Apply as an official. The address, its verification and the account
   * name come from the session, never the request: the check is only as
   * good as what it is given. A granted application earns the verified
   * official role; the operator's callback later raises the standing but
   * changes no role.
   */
  /**
   * Sign up to contribute to Daylight (D27). Joining local-hub grants no
   * contribution rights; this explicit agreement does, and only for an
   * account whose email address is verified. Signing up again is harmless.
   */
  @Post('contributor')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign up as a Daylight contributor' })
  @ApiResponse({ status: 200, type: MembershipReply })
  async signUpAsContributor(
    @User() user: UserDetails,
    @Body() _body: ContributorSignUpRequest
  ) {
    if (user.emailVerified !== true) {
      throw new ForbiddenException({
        message:
          'Verify your email address before signing up to contribute. Use the link we sent when you registered.',
        code: 'EMAIL_VERIFICATION_REQUIRED',
      });
    }
    await this.civic.grantRole(user.profileId, 'local_hub_contributor');
    // The permission checks cache their answers; drop the denials cached
    // before the grant (the report page asks before signing up).
    await this.permissionsCache.invalidateProfile(user.profileId);
    const access = await this.civic.access(user.profileId);
    return {
      data: {
        profileId: user.profileId,
        handle: user.name,
        emailVerified: true,
        ...access,
      },
    };
  }

  @Post('officials/apply')
  @HttpCode(200)
  @ApiOperation({ summary: 'Apply for verified-official standing' })
  @ApiResponse({ status: 200, type: OfficialApplicationReply })
  async applyOfficial(
    @User() user: UserDetails,
    @Body() body: OfficialApplicationRequest
  ) {
    const { actor } = await this.civic.actor(user);
    const result = await this.civic.call<OfficialApplicationResult>(
      CommunityCommands.ApplyOfficial,
      {
        actor,
        email: user.email,
        emailVerified: user.emailVerified === true,
        name: user.name,
        localitySlug: body.localitySlug,
      }
    );
    if (result.granted) {
      await this.civic.grantRole(user.profileId, 'local_hub_verified_official');
      await this.permissionsCache.invalidateProfile(user.profileId);
    }
    return { data: result };
  }

  /**
   * A town's community surface, for anyone: corroborated reports and labeled
   * single reports, each quoted as written and attributed, and official
   * material labeled with what was checked.
   */
  @Public()
  @Get('editions/:slug/community')
  @ApiOperation({ summary: "A town's community surface" })
  @ApiResponse({ status: 200, type: CommunitySurfaceReply })
  async surface(@Param('slug') slug: string) {
    return {
      data: await this.civic.call<CommunitySurface>(CommunityCommands.Surface, {
        localitySlug: slug,
      }),
    };
  }

  /** A contributor's public page: handle, bio, and what they have reported and corroborated. No score. */
  @Public()
  @Get('contributors/:id')
  @ApiOperation({ summary: "A contributor's public page" })
  @ApiResponse({ status: 200, type: ContributorPageReply })
  async contributor(@Param('id', new ParseUUIDPipe()) id: string) {
    const page = await this.civic.call<ContributorPageView | null>(
      CommunityCommands.ContributorPage,
      { contributorId: id }
    );
    if (!page) throw new NotFoundException('No such contributor.');
    const { profileId, ...visible } = page;
    return { data: { ...visible, bio: await this.bio(profileId) } };
  }

  /**
   * An attachment on the surface, always as a download: a PDF can carry
   * script, and nothing contributed is ever rendered in this origin.
   */
  @Public()
  @Get('artifacts/:sha256')
  @ApiOperation({ summary: 'An attachment, as a download' })
  @ApiProduces('application/octet-stream')
  @ApiResponse({
    status: 200,
    schema: { type: 'string', format: 'binary' },
  })
  async artifact(@Param('sha256') sha256: string, @Res() response: Response) {
    const found = await this.civic.call<{
      mediaType: string;
      base64: string;
      filename: string;
    } | null>(CommunityCommands.Artifact, { sha256: sha256.toLowerCase() });
    if (!found) throw new NotFoundException('No such attachment.');
    response.set({
      'Content-Type': found.mediaType,
      'Content-Disposition': `attachment; filename="${found.filename}"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, max-age=300',
    });
    response.send(Buffer.from(found.base64, 'base64'));
  }

  /** A copyright notice. Anyone may file one; an operator decides it. */
  @Public()
  @Throttle(NOTICE_THROTTLE)
  @Post('copyright/notices')
  @ApiOperation({ summary: 'File a copyright notice' })
  @ApiResponse({ status: 201, type: TakedownNoticeReceiptReply })
  async fileNotice(@Body() body: TakedownNoticeBody) {
    return {
      data: await this.civic.call<{ id: string; locatedContributions: number }>(
        CommunityCommands.FileTakedownNotice,
        { ...body }
      ),
    };
  }

  /** A contributor's public bio, from their local-hub profile; empty when unavailable. */
  private async bio(profileId: string): Promise<string> {
    try {
      const found = await firstValueFrom(
        this.profiles
          .send<{ bio?: string }[]>(
            { cmd: ProfileCommands.GetAll },
            { where: { id: profileId, appScope: 'local-hub' } }
          )
          .pipe(timeout(5_000))
      );
      return found?.[0]?.bio ?? '';
    } catch {
      return '';
    }
  }
}

async function parseSubmission(
  raw: string | undefined
): Promise<SubmissionRequest> {
  let plain: unknown;
  try {
    plain = JSON.parse(raw ?? '');
  } catch {
    throw new BadRequestException(
      'The submission field must hold the contribution as JSON.'
    );
  }
  const submission = plainToInstance(SubmissionRequest, plain);
  const errors = await validate(submission, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length) {
    const messages = errors.flatMap((error) => [
      ...Object.values(error.constraints ?? {}),
      ...(error.children ?? []).flatMap((child) =>
        Object.values(child.constraints ?? {})
      ),
    ]);
    throw new BadRequestException(messages);
  }
  return submission;
}
