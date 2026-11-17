import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Header,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CommunityCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';
import { isIP } from 'node:net';
import type {
  LocalDirectoryListing,
  LocalDirectorySourceFreshness,
} from '@optimistic-tanuki/social-contracts';
import { Public } from '../../decorators/public.decorator';
import { AuthGuard } from '../../auth/auth.guard';

export class DirectoryOwnerScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (
      context.switchToHttp().getRequest().headers['x-ot-appscope'] !==
      'owner-console'
    )
      throw new ForbiddenException('Owner Console scope required');
    return true;
  }
}

@Controller('directory/towns')
export class DirectoryController {
  constructor(
    @Inject(ServiceTokens.SOCIAL_SERVICE) private readonly social: ClientProxy
  ) {}

  @Public()
  @Get(':id/local-evaluation-listings/:reference')
  @Header('Cache-Control', 'no-store')
  async localListingDetail(
    @Param('id') id: string,
    @Param('reference') reference: string,
    @Query('adult') adult?: string
  ) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      ) ||
      typeof reference !== 'string' ||
      !/^[A-Za-z0-9_-]{1,2048}$/.test(reference) ||
      (adult !== undefined && adult !== '1')
    )
      throw new BadRequestException('Invalid listing reference');
    const base = process.env.DIRECTORY_INTERNAL_URL,
      secret = process.env.DIRECTORY_LOCAL_EVALUATION_SECRET;
    if (
      process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
      !base ||
      !secret ||
      Buffer.byteLength(secret) < 32
    )
      throw new ServiceUnavailableException('Local directory unavailable');
    try {
      const suffix = adult === '1' ? '?adult=1' : '',
        response = await fetch(
          `${base.replace(
            /\/$/,
            ''
          )}/internal/local-evaluation/towns/${id.toLowerCase()}/listings/${reference}${suffix}`,
          {
            headers: { authorization: `Bearer ${secret}` },
            signal: AbortSignal.timeout(5000),
            redirect: 'error',
          }
        );
      if (response.status === 404)
        throw new NotFoundException('Listing unavailable');
      if (!response.ok) throw Error('Directory unavailable');
      const result = await response.json();
      if (!result || !result.listing) throw Error('Invalid listing');
      return this.projectLocalListing(result.listing, adult);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException('Local directory unavailable');
    }
  }

  /** Label-only pass-through; anything malformed is dropped rather than failing the page. */
  private projectSourceFreshness(value: any): {
    sourceFreshness?: LocalDirectorySourceFreshness;
  } {
    const text = (x: any, pattern: RegExp) =>
      x === null ||
      (typeof x === 'string' && x.length <= 40 && pattern.test(x));
    const days = (x: any) => Number.isSafeInteger(x) && x > 0 && x <= 3650;
    if (
      !value ||
      !['fresh', 'due', 'stale', 'unknown'].includes(value.state) ||
      !text(value.releaseId, /^\d{4}-\d{2}-\d{2}\.\d+$/) ||
      !text(value.sourcePublishedAt, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/) ||
      !text(value.acquiredAt, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/) ||
      !days(value.thresholds?.freshDays) ||
      !days(value.thresholds?.staleDays)
    )
      return {};
    const { state, releaseId, sourcePublishedAt, acquiredAt, thresholds } =
      value;
    return {
      sourceFreshness: {
        state,
        releaseId,
        sourcePublishedAt,
        acquiredAt,
        thresholds: {
          freshDays: thresholds.freshDays,
          staleDays: thresholds.staleDays,
        },
      },
    };
  }
  private projectLocalListing(
    entry: any,
    adult?: string,
    includeReference = false
  ): LocalDirectoryListing {
    if (entry?.adult === true && adult !== '1')
      throw Error('Unexpected adult listing');
    const text = (v: unknown) =>
      typeof v === 'string' &&
      !!v.trim() &&
      v.length <= 2000 &&
      !/[\x00-\x1f\x7f]/.test(v);
    const list = (v: unknown) =>
      Array.isArray(v) && v.length <= 50 && v.every(text);
    const c = entry?.location?.coordinates;
    if (
      !text(entry?.name) ||
      !text(entry?.category) ||
      entry?.location?.type !== 'Point' ||
      !Array.isArray(c) ||
      c.length !== 2 ||
      !c.every(Number.isFinite) ||
      Math.abs(c[0]) > 180 ||
      Math.abs(c[1]) > 90 ||
      !list(entry.attribution) ||
      !entry.attribution.length ||
      !list(entry.notices) ||
      !list(entry.termsUrls)
    )
      throw Error('Invalid listing');
    const listing: LocalDirectoryListing = {
      name: entry.name,
      category: entry.category,
      attribution: entry.attribution,
      notices: entry.notices,
      termsUrls: entry.termsUrls,
    };
    if (entry.id !== undefined) {
      if (
        typeof entry.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
          entry.id
        )
      )
        throw Error('Invalid listing identity');
      listing.id = entry.id;
    }
    if (includeReference) {
      if (
        typeof entry.reference !== 'string' ||
        !/^[A-Za-z0-9_-]{1,2048}$/.test(entry.reference)
      )
        throw Error('Invalid listing reference');
      listing.reference = entry.reference;
    }
    try {
      if (typeof entry.website === 'string' && entry.website.length <= 2048) {
        const u = new URL(entry.website),
          host = u.hostname.toLowerCase().replace(/\.$/, '');
        if (
          ['http:', 'https:'].includes(u.protocol) &&
          !u.username &&
          !u.password &&
          host.includes('.') &&
          !isIP(host.replace(/^\[|\]$/g, '')) &&
          !/(?:^|\.)(localhost|local|internal)$/.test(host)
        )
          listing.website = u.href;
      }
    } catch {
      /* Invalid optional field is hidden. */
    }
    if (
      typeof entry.phone === 'string' &&
      /^\+[1-9][0-9]{6,14}$/.test(entry.phone)
    )
      listing.phone = entry.phone;
    if (text(entry.address) && entry.address.length <= 300)
      listing.address = entry.address;
    if (listing.address) listing.coordinates = { lat: c[1], lng: c[0] };
    return listing;
  }

  @Public()
  @Get(':id/local-evaluation-listings')
  @Header('Cache-Control', 'no-store')
  async localListings(
    @Param('id') id: string,
    @Query('offset') offset?: string,
    @Query('q') search?: string,
    @Query('adult') adult?: string,
    @Query('category') category?: string,
    @Query('pagination') pagination?: string,
    @Query('cursor') cursor?: string,
    @Query('bounds') bounds?: string,
    @Query('identities') identities?: string
  ) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    )
      throw new BadRequestException('Invalid community ID');
    if (
      offset !== undefined &&
      (typeof offset !== 'string' ||
        !/^(0|[1-9][0-9]{0,6})$/.test(offset) ||
        Number(offset) > 1000000)
    )
      throw new BadRequestException('Invalid offset');
    if (
      search !== undefined &&
      (typeof search !== 'string' ||
        search.length > 100 ||
        /[\x00-\x1f\x7f]/.test(search))
    )
      throw new BadRequestException('Invalid search');
    if (adult !== undefined && adult !== '1')
      throw new BadRequestException('Invalid adult choice');
    if (
      category !== undefined &&
      (typeof category !== 'string' ||
        category.length > 100 ||
        !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(category))
    )
      throw new BadRequestException('Invalid category');
    if (
      (pagination !== undefined && pagination !== 'cursor') ||
      (cursor !== undefined &&
        (pagination !== 'cursor' ||
          typeof cursor !== 'string' ||
          !/^[A-Za-z0-9_-]{1,2048}$/.test(cursor))) ||
      (pagination === 'cursor' && offset !== undefined && offset !== '0')
    )
      throw new BadRequestException('Invalid cursor');
    if (identities !== undefined && identities !== '1')
      throw new BadRequestException('Invalid identity mode');
    if (
      bounds !== undefined &&
      (pagination !== 'cursor' ||
        typeof bounds !== 'string' ||
        bounds.length > 160 ||
        !bounds)
    )
      throw new BadRequestException('Invalid bounds');
    const base = process.env.DIRECTORY_INTERNAL_URL,
      secret = process.env.DIRECTORY_LOCAL_EVALUATION_SECRET;
    if (
      process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
      !base ||
      !secret ||
      Buffer.byteLength(secret) < 32
    )
      throw new ServiceUnavailableException('Local directory unavailable');
    try {
      const params = new URLSearchParams({
        offset: offset || '0',
        q: (search || '').trim(),
      });
      if (adult === '1') params.set('adult', '1');
      if (category) params.set('category', category);
      if (pagination) params.set('pagination', pagination);
      if (cursor) params.set('cursor', cursor);
      if (bounds) params.set('bounds', bounds);
      if (identities) params.set('identities', identities);
      const response = await fetch(
        `${base.replace(
          /\/$/,
          ''
        )}/internal/local-evaluation/towns/${id.toLowerCase()}/listings?${params}`,
        {
          headers: { authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(5000),
          redirect: 'error',
        }
      );
      if (response.status === 400 && pagination === 'cursor')
        throw new BadRequestException('Invalid cursor');
      if (!response.ok) throw Error('Directory unavailable');
      const result = await response.json();
      if (
        !result ||
        !Array.isArray(result.listings) ||
        result.listings.length > 25 ||
        typeof result.hasMore !== 'boolean'
      )
        throw Error('Invalid listings');
      const listings = result.listings.map((entry: any) =>
        this.projectLocalListing(entry, adult, pagination === 'cursor')
      );
      if (pagination === 'cursor') {
        if (
          result.nextCursor !== null &&
          (typeof result.nextCursor !== 'string' ||
            !/^[A-Za-z0-9_-]{1,2048}$/.test(result.nextCursor))
        )
          throw Error('Invalid cursor response');
        return {
          listings,
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
          ...this.projectSourceFreshness(result.sourceFreshness),
        };
      }
      return {
        listings,
        hasMore: result.hasMore,
        ...this.projectSourceFreshness(result.sourceFreshness),
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException('Local directory unavailable');
    }
  }

  @Get(':id/boundary-candidate')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard)
  @Header('Cache-Control', 'no-store')
  async boundaryCandidate(@Param('id') id: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    )
      throw new BadRequestException('Invalid community ID');
    id = id.toLowerCase();
    const base = process.env.DIRECTORY_INTERNAL_URL,
      secret = process.env.DIRECTORY_BOUNDARY_REVIEW_SECRET;
    if (!base || !secret || Buffer.byteLength(secret) < 32)
      throw new ServiceUnavailableException('Boundary review unavailable');
    try {
      const response = await fetch(
        `${base.replace(/\/$/, '')}/internal/towns/${id}/boundary-candidate`,
        {
          headers: { authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(2500),
          redirect: 'error',
        }
      );
      if (!response.ok) throw Error('Directory unavailable');
      const payload = await response.json(),
        c = payload?.candidate;
      if (c === null) return { candidate: null };
      if (
        !c ||
        c.communityId !== id ||
        !['place', 'cousub'].includes(c.layer) ||
        typeof c.geoid !== 'string' ||
        !(c.layer === 'place' ? /^\d{7}$/ : /^\d{10}$/).test(c.geoid) ||
        typeof c.vintage !== 'string' ||
        !/^\d{4}$/.test(c.vintage) ||
        typeof c.stateFips !== 'string' ||
        !/^\d{2}$/.test(c.stateFips) ||
        !c.geoid.startsWith(c.stateFips) ||
        typeof c.archiveSha256 !== 'string' ||
        !/^[a-f0-9]{64}$/.test(c.archiveSha256)
      )
        throw Error('Invalid candidate');
      if (
        typeof c.changeToken !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
          c.changeToken
        ) ||
        typeof c.geographyHash !== 'string' ||
        !/^[a-f0-9]{64}$/.test(c.geographyHash)
      )
        throw Error('Invalid candidate binding');
      const context = c.reviewContext,
        text = (v: unknown, n: number) =>
          typeof v === 'string' &&
          !!v.trim() &&
          v.length <= n &&
          !/[\x00-\x1f\x7f]/.test(v);
      if (
        !context ||
        !text(context.name, 255) ||
        !text(context.city, 100) ||
        !text(context.adminArea, 100) ||
        !text(context.countryCode, 3) ||
        !['city', 'town'].includes(context.localityType)
      )
        throw Error('Invalid review context');
      return {
        candidate: {
          communityId: id,
          geoid: c.geoid,
          layer: c.layer,
          vintage: c.vintage,
          stateFips: c.stateFips,
          archiveSha256: c.archiveSha256,
          changeToken: c.changeToken,
          geographyHash: c.geographyHash,
          reviewContext: {
            name: context.name,
            city: context.city,
            adminArea: context.adminArea,
            countryCode: context.countryCode,
            localityType: context.localityType,
          },
        },
      };
    } catch {
      throw new ServiceUnavailableException('Boundary review unavailable');
    }
  }

  @Post(':id/boundary-decisions')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard)
  @Header('Cache-Control', 'no-store')
  async boundaryDecision(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: { user?: { profileId?: string } }
  ) {
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    const reviewerId = req.user?.profileId;
    if (!reviewerId || !uuid.test(reviewerId))
      throw new ForbiddenException('Verified reviewer required');
    if (
      !uuid.test(id) ||
      !body ||
      !uuid.test(body.requestId || '') ||
      body.decision !== 'verified' ||
      body.attested !== true ||
      typeof body.sourceUrl !== 'string' ||
      body.sourceUrl.length > 2048 ||
      !body.candidate ||
      body.candidate.communityId !== id
    )
      throw new BadRequestException('Invalid boundary decision');
    const base = process.env.DIRECTORY_INTERNAL_URL,
      secret = process.env.DIRECTORY_BOUNDARY_DECISION_SECRET;
    if (
      !base ||
      !secret ||
      Buffer.byteLength(secret) < 32 ||
      [
        process.env.DIRECTORY_BOUNDARY_REVIEW_SECRET,
        process.env.DIRECTORY_PENDING_READ_SECRET,
        process.env.DIRECTORY_REGISTER_READ_SECRET,
      ].includes(secret)
    )
      throw new ServiceUnavailableException('Boundary decision unavailable');
    const c = body.candidate;
    const candidate = {
      communityId: c.communityId,
      changeToken: c.changeToken,
      geoid: c.geoid,
      layer: c.layer,
      vintage: c.vintage,
      stateFips: c.stateFips,
      archiveSha256: c.archiveSha256,
      geographyHash: c.geographyHash,
    };
    try {
      const response = await fetch(
        `${base.replace(/\/$/, '')}/internal/towns/${id}/boundary-decisions`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${secret}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            requestId: body.requestId,
            reviewerId,
            decision: body.decision,
            attested: body.attested,
            sourceUrl: body.sourceUrl,
            candidate,
          }),
          signal: AbortSignal.timeout(2500),
          redirect: 'error',
        }
      );
      if (response.status !== 204) throw Error('Decision unavailable');
      return { recorded: true };
    } catch {
      throw new ServiceUnavailableException('Boundary decision unavailable');
    }
  }

  @Public()
  @Get(':id/boundary')
  @Header('Cache-Control', 'no-store')
  async boundary(@Param('id') id: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    )
      throw new BadRequestException('Invalid community ID');
    id = id.toLowerCase();
    const secret = process.env.DIRECTORY_CONTAINMENT_READ_SECRET;
    if (!secret) return this.lookup(id);
    const base = process.env.DIRECTORY_INTERNAL_URL;
    if (
      !base ||
      Buffer.byteLength(secret) < 32 ||
      [
        process.env.DIRECTORY_PENDING_READ_SECRET,
        process.env.DIRECTORY_BOUNDARY_REVIEW_SECRET,
        process.env.DIRECTORY_BOUNDARY_DECISION_SECRET,
        process.env.DIRECTORY_REGISTER_READ_SECRET,
      ].includes(secret)
    )
      throw new ServiceUnavailableException('Boundary unavailable');
    try {
      const response = await fetch(
        `${base.replace(/\/$/, '')}/internal/towns/${id}/boundary`,
        {
          headers: { authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(5000),
          redirect: 'error',
        }
      );
      if (response.status === 404) throw new NotFoundException();
      if (!response.ok) throw Error('Boundary unavailable');
      let result: any;
      if (response.body) {
        const reader = response.body.getReader(),
          chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 8 * 1024 * 1024) {
            await reader.cancel();
            throw Error('Boundary too large');
          }
          chunks.push(part.value);
        }
        result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } else result = await response.json();
      if (result?.status === 'pending')
        return { town: { id }, status: 'pending' };
      const geometry = result?.geometry;
      const position = (p: unknown): boolean =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
        Math.abs(p[0]) <= 180 &&
        Math.abs(p[1]) <= 90;
      const ring = (r: unknown): boolean =>
        Array.isArray(r) && r.length >= 4 && r.every(position);
      const polygon = (p: unknown): boolean =>
        Array.isArray(p) && p.length > 0 && p.every(ring);
      if (
        result?.status !== 'ready' ||
        !geometry ||
        !(geometry.type === 'Polygon'
          ? polygon(geometry.coordinates)
          : geometry.type === 'MultiPolygon' &&
            Array.isArray(geometry.coordinates) &&
            geometry.coordinates.length > 0 &&
            geometry.coordinates.every(polygon))
      )
        throw Error('Invalid boundary geometry');
      return {
        town: { id },
        status: 'ready',
        geometry: { type: geometry.type, coordinates: geometry.coordinates },
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException('Boundary unavailable');
    }
  }

  @Public()
  @Get(':id/status')
  @Header('Cache-Control', 'no-store')
  async status(@Param('id') id: string) {
    return this.lookup(id);
  }

  @Public()
  @Get(':id/validate')
  @Header('Cache-Control', 'no-store')
  async validate(
    @Param('id') id: string,
    @Query('longitude') longitude: string,
    @Query('latitude') latitude: string
  ) {
    if (
      typeof longitude !== 'string' ||
      typeof latitude !== 'string' ||
      !longitude.trim() ||
      !latitude.trim() ||
      !Number.isFinite(Number(longitude)) ||
      !Number.isFinite(Number(latitude)) ||
      Math.abs(Number(longitude)) > 180 ||
      Math.abs(Number(latitude)) > 90
    ) {
      throw new BadRequestException('Invalid WGS84 point');
    }
    const secret = process.env.DIRECTORY_CONTAINMENT_READ_SECRET;
    if (!secret) return this.lookup(id);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    )
      throw new BadRequestException('Invalid community ID');
    id = id.toLowerCase();
    const base = process.env.DIRECTORY_INTERNAL_URL;
    if (
      !base ||
      Buffer.byteLength(secret) < 32 ||
      [
        process.env.DIRECTORY_PENDING_READ_SECRET,
        process.env.DIRECTORY_BOUNDARY_REVIEW_SECRET,
        process.env.DIRECTORY_BOUNDARY_DECISION_SECRET,
        process.env.DIRECTORY_REGISTER_READ_SECRET,
      ].includes(secret)
    )
      throw new ServiceUnavailableException('Containment unavailable');
    try {
      const query = new URLSearchParams({
        longitude: String(Number(longitude)),
        latitude: String(Number(latitude)),
      });
      const response = await fetch(
        `${base.replace(/\/$/, '')}/internal/towns/${id}/containment?${query}`,
        {
          headers: { authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(2500),
          redirect: 'error',
        }
      );
      if (response.status === 404) throw new NotFoundException();
      if (!response.ok) throw Error('Containment unavailable');
      const result = await response.json();
      if (result?.status === 'pending')
        return { town: { id }, status: 'pending' };
      if (result?.status === 'ready' && typeof result.covers === 'boolean')
        return { town: { id }, status: 'ready', covers: result.covers };
      throw Error('Invalid containment response');
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException('Containment unavailable');
    }
  }

  private async lookup(id: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id
      )
    )
      throw new BadRequestException('Invalid community ID');
    id = id.toLowerCase();
    const pendingSecret = process.env.DIRECTORY_PENDING_READ_SECRET;
    if (pendingSecret) {
      const base = process.env.DIRECTORY_INTERNAL_URL;
      if (!base || Buffer.byteLength(pendingSecret) < 32)
        throw new ServiceUnavailableException('Directory unavailable');
      try {
        const response = await fetch(
          `${base.replace(/\/$/, '')}/internal/register-towns/${id}/status`,
          {
            headers: { authorization: `Bearer ${pendingSecret}` },
            signal: AbortSignal.timeout(2500),
            redirect: 'error',
          }
        );
        if (response.status === 404) throw new NotFoundException();
        if (!response.ok) throw Error('Directory unavailable');
        const body = await response.json(),
          location = body?.approximateLocation;
        if (
          body?.status !== 'pending' ||
          !(
            location === null ||
            (location &&
              Array.isArray(location.coordinates) &&
              location.coordinates.length === 2 &&
              [0, 1].every(
                (i) =>
                  Object.prototype.hasOwnProperty.call(
                    location.coordinates,
                    i
                  ) &&
                  typeof location.coordinates[i] === 'number' &&
                  Number.isFinite(location.coordinates[i])
              ) &&
              Math.abs(location.coordinates[0]) <= 180 &&
              Math.abs(location.coordinates[1]) <= 90 &&
              location.label ===
                'Approximate town location; verified boundary unavailable.')
          )
        )
          throw Error('Invalid Directory response');
        return {
          town: { id },
          status: 'pending',
          approximateLocation:
            location === null
              ? null
              : {
                  coordinates: [...location.coordinates],
                  label:
                    'Approximate town location; verified boundary unavailable.',
                },
        };
      } catch (error) {
        if (error instanceof NotFoundException) throw error;
        throw new ServiceUnavailableException('Directory unavailable');
      }
    }
    const secret = process.env.DIRECTORY_ELIGIBILITY_SECRET;
    if (!secret) throw new ServiceUnavailableException('Social unavailable');
    let town: { id: string } | null;
    try {
      town = await firstValueFrom(
        this.social
          .send(
            { cmd: CommunityCommands.FIND_DIRECTORY_ELIGIBLE },
            { id, secret }
          )
          .pipe(timeout(2500))
      );
    } catch {
      throw new ServiceUnavailableException('Social unavailable');
    }
    if (town === null) throw new NotFoundException();
    if (!town || typeof town.id !== 'string' || town.id.toLowerCase() !== id) {
      throw new ServiceUnavailableException('Invalid Social response');
    }
    const base = process.env.DIRECTORY_INTERNAL_URL;
    if (!base) throw new ServiceUnavailableException('Directory unavailable');
    try {
      const response = await fetch(
        `${base.replace(/\/$/, '')}/internal/towns/${id}/status`,
        { signal: AbortSignal.timeout(2500), redirect: 'error' }
      );
      if (!response.ok || (await response.json()).status !== 'pending')
        throw new Error('Invalid directory response');
    } catch {
      throw new ServiceUnavailableException('Directory unavailable');
    }
    // Only return the canonical requested ID; eligibility may change while Directory is in flight.
    return { town: { id }, status: 'pending' };
  }
}
