import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  CommunityCommands,
  PaymentCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';
import { Public } from '../../decorators/public.decorator';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { DIRECTORY_PERMISSIONS } from '@optimistic-tanuki/social-contracts';
import { DirectoryOwnerScopeGuard } from './directory.controller';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type RequestUser = { user?: { userId?: string; profileId?: string } };
@Controller(
  'directory/towns/:townId/local-evaluation-listings/:listingId/business-link'
)
export class DirectoryBusinessLinkController {
  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE) private readonly social: ClientProxy,
    @Inject(ServiceTokens.PAYMENTS_SERVICE)
    private readonly payments: ClientProxy
  ) {}
  private config() {
    const base = process.env.DIRECTORY_INTERNAL_URL,
      secret = process.env.DIRECTORY_BUSINESS_LINK_SECRET;
    if (
      process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
      !base ||
      !secret ||
      Buffer.byteLength(secret) < 32
    )
      throw new ServiceUnavailableException('Business link unavailable');
    return { base: base.replace(/\/$/, ''), secret };
  }
  private validate(town: string, listing: string, adult?: string) {
    if (
      !uuid.test(town) ||
      !uuid.test(listing) ||
      (adult !== undefined && adult !== '1')
    )
      throw new BadRequestException('Invalid business link');
  }
  private async publicPage(
    communityId: string,
    ownerId: string
  ): Promise<{ communityId: string; slug: string; name: string } | null> {
    try {
      const [community, page] = await Promise.all([
        firstValueFrom(
          this.social
            .send({ cmd: CommunityCommands.FIND }, { id: communityId })
            .pipe(timeout(2500))
        ),
        firstValueFrom(
          this.payments
            .send({ cmd: PaymentCommands.GET_BUSINESS_PAGE }, { communityId })
            .pipe(timeout(2500))
        ),
      ]);
      if (
        !community ||
        community.id !== communityId ||
        community.appScope !== 'local-hub' ||
        community.isPrivate !== false ||
        typeof community.slug !== 'string' ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(community.slug) ||
        typeof community.name !== 'string' ||
        !community.name.trim() ||
        community.name.length > 255 ||
        /[\x00-\x1f\x7f]/.test(community.name) ||
        !page ||
        page.communityId !== communityId ||
        page.ownerId !== ownerId
      )
        return null;
      return { communityId, slug: community.slug, name: community.name };
    } catch {
      throw new ServiceUnavailableException('Business link unavailable');
    }
  }
  private async send(town: string, action: string, value: object) {
    const { base, secret } = this.config();
    try {
      const r = await fetch(
        `${base}/internal/local-evaluation/towns/${town}/business-links`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${secret}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ action, value }),
          signal: AbortSignal.timeout(5000),
          redirect: 'error',
        }
      );
      if (r.status !== 204) throw Error();
      return { recorded: true };
    } catch {
      throw new ServiceUnavailableException('Business link unavailable');
    }
  }
  @Public()
  @Get()
  @Header('Cache-Control', 'no-store')
  async read(
    @Param('townId') town: string,
    @Param('listingId') listing: string,
    @Query('adult') adult?: string
  ) {
    this.validate(town, listing, adult);
    const { base, secret } = this.config();
    let link: any;
    try {
      const r = await fetch(
        `${base}/internal/local-evaluation/towns/${town}/business-links/${listing}${
          adult === '1' ? '?adult=1' : ''
        }`,
        {
          headers: { authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(5000),
          redirect: 'error',
        }
      );
      if (!r.ok) throw Error();
      link = (await r.json())?.link;
    } catch {
      throw new ServiceUnavailableException('Business link unavailable');
    }
    if (link === null) return { link: null };
    if (
      !link ||
      typeof link.businessCommunityId !== 'string' ||
      !uuid.test(link.businessCommunityId) ||
      typeof link.ownerId !== 'string' ||
      !uuid.test(link.ownerId)
    )
      throw new ServiceUnavailableException('Business link unavailable');
    return {
      link: await this.publicPage(link.businessCommunityId, link.ownerId),
    };
  }
  @Post('requests')
  @UseGuards(AuthGuard)
  @Header('Cache-Control', 'no-store')
  async request(
    @Param('townId') town: string,
    @Param('listingId') listing: string,
    @Body() body: any,
    @Req() req: RequestUser
  ) {
    this.validate(town, listing);
    const userId = req.user?.userId;
    if (!userId || !uuid.test(userId))
      throw new ForbiddenException('Authenticated owner required');
    const byId =
        typeof body?.businessCommunityId === 'string' &&
        uuid.test(body.businessCommunityId),
      bySlug =
        typeof body?.businessSlug === 'string' &&
        body.businessSlug.length <= 100 &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.businessSlug);
    if (
      !body ||
      byId === bySlug ||
      (byId && body.businessSlug !== undefined) ||
      (bySlug && body.businessCommunityId !== undefined) ||
      !uuid.test(body.requestId || '') ||
      (body.adult !== undefined && typeof body.adult !== 'boolean')
    )
      throw new BadRequestException('Invalid business link');
    this.config();
    let businessCommunityId = body.businessCommunityId;
    if (bySlug) {
      try {
        const community = await firstValueFrom(
          this.social
            .send(
              { cmd: CommunityCommands.FIND_BY_SLUG },
              { slug: body.businessSlug }
            )
            .pipe(timeout(2500))
        );
        if (
          !community ||
          community.slug !== body.businessSlug ||
          typeof community.id !== 'string' ||
          !uuid.test(community.id)
        )
          throw new ForbiddenException('Business page owner required');
        businessCommunityId = community.id;
      } catch (error) {
        if (error instanceof ForbiddenException) throw error;
        throw new ServiceUnavailableException('Business link unavailable');
      }
    }
    if (!(await this.publicPage(businessCommunityId, userId)))
      throw new ForbiddenException('Business page owner required');
    return this.send(town, 'request', {
      townId: town,
      listingId: listing,
      businessCommunityId,
      ownerId: userId,
      requestId: body.requestId,
      adult: body.adult === true,
    });
  }
  @Get('requests')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async requests(
    @Param('townId') town: string,
    @Param('listingId') listing: string,
    @Req() req: RequestUser
  ) {
    this.validate(town, listing);
    const reviewerId = req.user?.profileId;
    if (!reviewerId || !uuid.test(reviewerId))
      throw new ForbiddenException('Verified reviewer required');
    const { base, secret } = this.config();
    try {
      const response = await fetch(
        `${base}/internal/local-evaluation/towns/${town}/business-links/${listing}/requests`,
        {
          headers: { authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(5000),
          redirect: 'error',
        }
      );
      if (!response.ok) throw Error();
      const result = await response.json();
      if (!Array.isArray(result?.requests) || result.requests.length > 100)
        throw Error();
      return {
        requests: result.requests.map((row: any) => {
          if (
            !row ||
            ![row.requestId, row.businessCommunityId, row.ownerId].every(
              (x) => typeof x === 'string' && uuid.test(x)
            )
          )
            throw Error();
          return {
            requestId: row.requestId,
            businessCommunityId: row.businessCommunityId,
            ownerId: row.ownerId,
          };
        }),
      };
    } catch {
      throw new ServiceUnavailableException('Business link unavailable');
    }
  }
  @Post('reviews')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async review(
    @Param('townId') town: string,
    @Param('listingId') listing: string,
    @Body() body: any,
    @Req() req: RequestUser
  ) {
    this.validate(town, listing);
    const reviewerId = req.user?.profileId;
    if (!reviewerId || !uuid.test(reviewerId))
      throw new ForbiddenException('Verified reviewer required');
    if (
      !body ||
      !uuid.test(body.businessCommunityId || '') ||
      !uuid.test(body.ownerId || '') ||
      !uuid.test(body.requestId || '') ||
      !['approve', 'reject'].includes(body.decision) ||
      body.attested !== true ||
      typeof body.evidenceUrl !== 'string' ||
      (body.adult !== undefined && typeof body.adult !== 'boolean')
    )
      throw new BadRequestException('Invalid business link');
    this.config();
    if (
      body.decision === 'approve' &&
      !(await this.publicPage(body.businessCommunityId, body.ownerId))
    )
      throw new ForbiddenException('Business page owner required');
    return this.send(town, 'review', {
      townId: town,
      listingId: listing,
      businessCommunityId: body.businessCommunityId,
      ownerId: body.ownerId,
      requestId: body.requestId,
      reviewerId,
      decision: body.decision,
      evidenceUrl: body.evidenceUrl,
      adult: body.adult === true,
    });
  }
  @Get('mine')
  @UseGuards(AuthGuard)
  @Header('Cache-Control', 'no-store')
  async mine(
    @Param('townId') town: string,
    @Param('listingId') listing: string,
    @Req() req: RequestUser
  ) {
    this.validate(town, listing);
    const ownerId = req.user?.userId;
    if (!ownerId || !uuid.test(ownerId))
      throw new ForbiddenException('Authenticated owner required');
    const { base, secret } = this.config();
    try {
      const response = await fetch(
        `${base}/internal/local-evaluation/towns/${town}/business-links/${listing}/owner/${ownerId}`,
        {
          headers: { authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(5000),
          redirect: 'error',
        }
      );
      if (!response.ok) throw Error();
      const result = await response.json();
      if (!Array.isArray(result?.requests) || result.requests.length > 100)
        throw Error();
      return {
        requests: result.requests.map((row: any) => {
          if (
            !row ||
            ![row.requestId, row.businessCommunityId].every(
              (x) => typeof x === 'string' && uuid.test(x)
            ) ||
            !['pending', 'approved'].includes(row.status)
          )
            throw Error();
          return {
            requestId: row.requestId,
            businessCommunityId: row.businessCommunityId,
            status: row.status,
          };
        }),
      };
    } catch {
      throw new ServiceUnavailableException('Business link unavailable');
    }
  }
  @Post('revoke')
  @UseGuards(AuthGuard)
  @Header('Cache-Control', 'no-store')
  async revoke(
    @Param('townId') town: string,
    @Param('listingId') listing: string,
    @Body() body: any,
    @Req() req: RequestUser
  ) {
    this.validate(town, listing);
    const actorId = req.user?.userId;
    if (!actorId || !uuid.test(actorId))
      throw new ForbiddenException('Authenticated owner required');
    if (!body || !uuid.test(body.requestId || ''))
      throw new BadRequestException('Invalid business link');
    return this.send(town, 'revoke', {
      townId: town,
      listingId: listing,
      requestId: body.requestId,
      actorId,
      actorRole: 'owner',
    });
  }
}

@Controller('directory/towns/:townId/business-link-requests')
export class DirectoryBusinessLinkQueueController {
  @Get()
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async requests(
    @Param('townId') town: string,
    @Req() req: RequestUser,
    @Query('cursor') cursor?: string
  ) {
    if (
      cursor !== undefined &&
      (typeof cursor !== 'string' || !uuid.test(cursor))
    )
      throw new BadRequestException('Invalid cursor');
    if (!uuid.test(town)) throw new BadRequestException('Invalid town');
    const reviewerId = req.user?.profileId;
    if (!reviewerId || !uuid.test(reviewerId))
      throw new ForbiddenException('Verified reviewer required');
    const base = process.env.DIRECTORY_INTERNAL_URL,
      secret = process.env.DIRECTORY_BUSINESS_LINK_SECRET;
    if (
      process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
      !base ||
      !secret ||
      Buffer.byteLength(secret) < 32
    )
      throw new ServiceUnavailableException('Business link unavailable');
    try {
      const response = await fetch(
        `${base.replace(
          /\/$/,
          ''
        )}/internal/local-evaluation/towns/${town}/business-link-requests${
          cursor ? '?cursor=' + cursor : ''
        }`,
        {
          headers: { authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(5000),
          redirect: 'error',
        }
      );
      if (!response.ok) throw Error();
      const result = await response.json();
      if (
        !Array.isArray(result?.requests) ||
        result.requests.length > 100 ||
        (result.nextCursor !== null &&
          (typeof result.nextCursor !== 'string' ||
            !uuid.test(result.nextCursor)))
      )
        throw Error();
      return {
        requests: result.requests.map((row: any) => {
          if (
            !row ||
            ![
              row.listingId,
              row.requestId,
              row.businessCommunityId,
              row.ownerId,
            ].every((x) => typeof x === 'string' && uuid.test(x))
          )
            throw Error();
          return {
            listingId: row.listingId,
            requestId: row.requestId,
            businessCommunityId: row.businessCommunityId,
            ownerId: row.ownerId,
          };
        }),
        nextCursor: result.nextCursor,
      };
    } catch {
      throw new ServiceUnavailableException('Business link unavailable');
    }
  }
}
