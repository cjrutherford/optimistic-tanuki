import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { DIRECTORY_PERMISSIONS } from '@optimistic-tanuki/social-contracts';
import { DirectoryOwnerScopeGuard } from './directory.controller';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const actions = ['keep_separate', 'merge', 'undo'];
const states = ['queued', 'kept_separate', 'merged'];
const rules = ['same_name_near', 'similar_name'];
const verdicts = ['duplicate', 'distinct'];
const round = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const seedPattern = /^[A-Za-z0-9._-]{1,64}$/;
type RequestUser = { user?: { profileId?: string } };
interface DuplicatePage {
  cases: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Reviewer-only queue of uncertain duplicates (owner decision D13). The weaker listing is hidden when the case is
 * queued; a reviewer keeps the pair separate (the listing returns), merges (it stays hidden) or undoes a decision.
 * The queue is paged on the server (`state`, `rule`, `limit`, `offset`); `:caseId` shows the pair side by side with
 * its history; a decision may carry `expectedState` and a stale one is refused with 409. `samples` is the D18
 * wrong-merge check: a fixed seeded random sample of pairs per review round, judged by a reviewer, with the observed
 * rate reported against the 2% limit.
 */
@Controller('directory/towns/:townId/duplicate-cases')
export class DirectoryDuplicateCasesController {
  private config(): { base: string; secret: string } {
    const base = process.env.DIRECTORY_INTERNAL_URL;
    const secret = process.env.DIRECTORY_LOCAL_EVALUATION_SECRET;
    if (
      process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
      !base ||
      !secret ||
      Buffer.byteLength(secret) < 32
    ) {
      throw this.unavailable();
    }
    return { base: base.replace(/\/$/, ''), secret };
  }

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException('Duplicate review unavailable');
  }

  private town(value: string): void {
    if (!uuid.test(value)) throw new BadRequestException('Invalid town');
  }

  private reviewer(req: RequestUser): string {
    const reviewerId = req?.user?.profileId;
    if (!reviewerId || !uuid.test(reviewerId)) {
      throw new ForbiddenException('Verified reviewer required');
    }
    return reviewerId;
  }

  private text(value: unknown, max: number): value is string {
    return typeof value === 'string' && value.length <= max;
  }

  private listing(value: any): { scanId: string; sourceFileRowNumber: string } {
    if (
      !value ||
      !this.text(value.scanId, 64) ||
      !/^[0-9]{1,18}$/.test(String(value.sourceFileRowNumber))
    )
      throw this.unavailable();
    return {
      scanId: value.scanId,
      sourceFileRowNumber: String(value.sourceFileRowNumber),
    };
  }

  private page(result: any): { total: number; limit: number; offset: number } {
    const ok = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
    if (!ok(result?.total) || !ok(result?.limit) || !ok(result?.offset))
      throw this.unavailable();
    return { total: result.total, limit: result.limit, offset: result.offset };
  }

  private project(result: any): DuplicatePage {
    const rows = result?.cases;
    if (!Array.isArray(rows) || rows.length > 200) throw this.unavailable();
    return {
      ...this.page(result),
      cases: rows.map((r: any) => {
        return this.caseRow(r);
      }),
    };
  }

  private name(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    if (!this.text(v, 300)) throw this.unavailable();
    return v;
  }

  private caseRow(r: any): Record<string, unknown> {
    if (
      !r ||
      typeof r.caseId !== 'string' ||
      !uuid.test(r.caseId) ||
      !states.includes(r.state) ||
      !this.text(r.rule, 64) ||
      !this.text(r.weakerBasis, 64) ||
      !Number.isInteger(r.distanceMeters) ||
      !this.text(r.createdAt, 64) ||
      Number.isNaN(Date.parse(r.createdAt))
    )
      throw this.unavailable();
    return {
      caseId: r.caseId,
      state: r.state,
      rule: r.rule,
      weakerBasis: r.weakerBasis,
      distanceMeters: r.distanceMeters,
      kept: this.listing(r.kept),
      hidden: this.listing(r.hidden),
      keptName: this.name(r.keptName),
      hiddenName: this.name(r.hiddenName),
      createdAt: r.createdAt,
    };
  }

  private strings(v: unknown): string[] {
    if (!Array.isArray(v) || v.length > 10) throw this.unavailable();
    return v.map((x) => {
      if (!this.text(x, 300)) throw this.unavailable();
      return x;
    });
  }

  private view(v: any): Record<string, unknown> {
    const c = v?.coordinates;
    if (
      !v ||
      typeof v.hidden !== 'boolean' ||
      (c !== null &&
        !(Array.isArray(c) && c.length === 2 && c.every(Number.isFinite)))
    )
      throw this.unavailable();
    return {
      ...this.listing(v),
      name: this.name(v.name),
      category: this.name(v.category),
      addresses: this.strings(v.addresses),
      phones: this.strings(v.phones),
      websites: this.strings(v.websites),
      sources: this.strings(v.sources),
      coordinates: c,
      hidden: v.hidden,
    };
  }

  private detail(r: any): Record<string, unknown> {
    const history = r?.history;
    if (!Array.isArray(history) || history.length > 200)
      throw this.unavailable();
    return {
      ...this.caseRow(r),
      decidedAt:
        r.decidedAt === null || r.decidedAt === undefined
          ? null
          : this.date(r.decidedAt),
      keptListing: this.view(r.keptListing),
      hiddenListing: this.view(r.hiddenListing),
      history: history.map((h: any) => {
        if (
          !h ||
          !this.text(h.eventId, 64) ||
          !this.text(h.kind, 16) ||
          (h.actorId !== null &&
            !(typeof h.actorId === 'string' && uuid.test(h.actorId)))
        )
          throw this.unavailable();
        return {
          eventId: h.eventId,
          kind: h.kind,
          actorId: h.actorId,
          note:
            h.note === null || h.note === undefined
              ? null
              : this.noteText(h.note),
          createdAt: this.date(h.createdAt),
        };
      }),
    };
  }

  private noteText(v: unknown): string {
    if (!this.text(v, 1100)) throw this.unavailable();
    return v;
  }

  private date(v: unknown): string {
    if (!this.text(v, 64) || Number.isNaN(Date.parse(v)))
      throw this.unavailable();
    return v;
  }

  private count(v: unknown): number {
    if (!Number.isInteger(v) || (v as number) < 0) throw this.unavailable();
    return v as number;
  }

  private rate(v: unknown): number | null {
    if (v === null) return null;
    if (typeof v !== 'number' || !(v >= 0 && v <= 1)) throw this.unavailable();
    return v;
  }

  private report(r: any): Record<string, unknown> {
    if (
      !r ||
      typeof r.complete !== 'boolean' ||
      typeof r.withinLimit !== 'boolean' ||
      typeof r.limit !== 'number'
    )
      throw this.unavailable();
    return {
      sampleSize: this.count(r.sampleSize),
      judged: this.count(r.judged),
      unjudged: this.count(r.unjudged),
      wrong: this.count(r.wrong),
      rate: this.rate(r.rate),
      upperBound95: this.rate(r.upperBound95),
      limit: r.limit,
      withinLimit: r.withinLimit,
      complete: r.complete,
    };
  }

  private sample(r: any): Record<string, unknown> {
    if (
      !r ||
      typeof r.sampleId !== 'string' ||
      !uuid.test(r.sampleId) ||
      !this.text(r.round, 64) ||
      !this.text(r.seed, 64) ||
      !(
        r.createdById === null ||
        (typeof r.createdById === 'string' && uuid.test(r.createdById))
      )
    )
      throw this.unavailable();
    return {
      sampleId: r.sampleId,
      round: r.round,
      seed: r.seed,
      populationSize: this.count(r.populationSize),
      createdAt: this.date(r.createdAt),
      createdById: r.createdById,
      report: this.report(r.report),
    };
  }

  private item(r: any): Record<string, unknown> {
    if (
      !r ||
      typeof r.caseId !== 'string' ||
      !uuid.test(r.caseId) ||
      !states.includes(r.state) ||
      !this.text(r.rule, 64) ||
      !(r.verdict === null || verdicts.includes(r.verdict))
    )
      throw this.unavailable();
    return {
      caseId: r.caseId,
      state: r.state,
      rule: r.rule,
      distanceMeters: this.count(r.distanceMeters),
      keptName: this.name(r.keptName),
      hiddenName: this.name(r.hiddenName),
      verdict: r.verdict,
      judgedAt: r.judgedAt === null ? null : this.date(r.judgedAt),
    };
  }

  private async send(
    url: string,
    init: RequestInit
  ): Promise<Record<string, any>> {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(5000),
        redirect: 'error',
      });
    } catch {
      throw this.unavailable();
    }
    if (response.status === 409)
      throw new ConflictException('Duplicate decision refused');
    if (response.status === 404)
      throw new NotFoundException('Duplicate case unavailable');
    if (response.status === 400)
      throw new BadRequestException('Invalid duplicate decision');
    try {
      if (!response.ok) throw Error();
      return await response.json();
    } catch {
      throw this.unavailable();
    }
  }

  private get(path: string, search = ''): Promise<Record<string, any>> {
    const { base, secret } = this.config();
    return this.send(`${base}/internal/local-evaluation/${path}${search}`, {
      headers: { authorization: `Bearer ${secret}` },
    });
  }

  @Get()
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async list(
    @Param('townId') town: string,
    @Query() query: Record<string, unknown>,
    @Req() req: RequestUser
  ): Promise<DuplicatePage> {
    this.town(town);
    this.reviewer(req);
    const params = new URLSearchParams();
    const q = query ?? {};
    for (const key of Object.keys(q)) {
      const value = q[key];
      if (
        typeof value !== 'string' ||
        !['state', 'rule', 'limit', 'offset'].includes(key)
      )
        throw new BadRequestException('Invalid duplicate query');
      if (
        (key === 'state' && !states.includes(value)) ||
        (key === 'rule' && !rules.includes(value)) ||
        (key === 'limit' &&
          !(/^[0-9]{1,3}$/.test(value) && +value >= 1 && +value <= 100)) ||
        (key === 'offset' && !/^[0-9]{1,8}$/.test(value))
      )
        throw new BadRequestException('Invalid duplicate query');
      params.set(key, value);
    }
    const search = params.toString();
    return this.project(
      await this.get(
        `towns/${town}/duplicate-cases`,
        search ? `?${search}` : ''
      )
    );
  }

  @Get('samples')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async samples(
    @Param('townId') town: string,
    @Req() req: RequestUser
  ): Promise<{ samples: Record<string, unknown>[] }> {
    this.town(town);
    this.reviewer(req);
    const result = await this.get(`towns/${town}/duplicate-cases/samples`);
    if (!Array.isArray(result?.samples) || result.samples.length > 50)
      throw this.unavailable();
    return { samples: result.samples.map((s: any) => this.sample(s)) };
  }

  @Post('samples')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async draw(
    @Param('townId') town: string,
    @Body() body: any,
    @Req() req: RequestUser
  ): Promise<{ replayed: boolean; sample: Record<string, unknown> }> {
    this.town(town);
    const actorId = this.reviewer(req);
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some((k) => !['round', 'size', 'seed'].includes(k)) ||
      typeof body.round !== 'string' ||
      !round.test(body.round) ||
      (body.size !== undefined &&
        !(
          Number.isInteger(body.size) &&
          body.size >= 1 &&
          body.size <= 1000
        )) ||
      (body.seed !== undefined &&
        !(typeof body.seed === 'string' && seedPattern.test(body.seed)))
    )
      throw new BadRequestException('Invalid duplicate sample');
    const { base, secret } = this.config();
    const result = await this.send(
      `${base}/internal/local-evaluation/towns/${town}/duplicate-cases/samples`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          round: body.round,
          ...(body.size === undefined ? {} : { size: body.size }),
          ...(body.seed === undefined ? {} : { seed: body.seed }),
          actorId,
        }),
      }
    );
    if (typeof result?.replayed !== 'boolean') throw this.unavailable();
    return { replayed: result.replayed, sample: this.sample(result.sample) };
  }

  @Get('samples/:sampleId')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async sampleDetail(
    @Param('townId') town: string,
    @Param('sampleId') sampleId: string,
    @Req() req: RequestUser
  ): Promise<{
    sample: Record<string, unknown>;
    items: Record<string, unknown>[];
  }> {
    this.town(town);
    this.reviewer(req);
    if (!uuid.test(sampleId)) throw new BadRequestException('Invalid sample');
    const result = await this.get(
      `towns/${town}/duplicate-cases/samples/${sampleId}`
    );
    if (!Array.isArray(result?.items) || result.items.length > 1000)
      throw this.unavailable();
    return {
      sample: this.sample(result.sample),
      items: result.items.map((i: any) => this.item(i)),
    };
  }

  @Post('samples/:sampleId/judge')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async judge(
    @Param('townId') town: string,
    @Param('sampleId') sampleId: string,
    @Body() body: any,
    @Req() req: RequestUser
  ): Promise<{ replayed: boolean; report: Record<string, unknown> }> {
    this.town(town);
    const actorId = this.reviewer(req);
    if (
      !uuid.test(sampleId) ||
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some((k) => !['caseId', 'verdict'].includes(k)) ||
      typeof body.caseId !== 'string' ||
      !uuid.test(body.caseId) ||
      !verdicts.includes(body.verdict)
    )
      throw new BadRequestException('Invalid sample judgement');
    const { base, secret } = this.config();
    const result = await this.send(
      `${base}/internal/local-evaluation/towns/${town}/duplicate-cases/samples/${sampleId}/judge`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          caseId: body.caseId,
          verdict: body.verdict,
          actorId,
        }),
      }
    );
    if (typeof result?.replayed !== 'boolean') throw this.unavailable();
    return { replayed: result.replayed, report: this.report(result.report) };
  }

  @Get(':caseId')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async detailCase(
    @Param('townId') town: string,
    @Param('caseId') caseId: string,
    @Req() req: RequestUser
  ): Promise<Record<string, unknown>> {
    this.town(town);
    this.reviewer(req);
    if (!uuid.test(caseId)) throw new BadRequestException('Invalid case');
    return this.detail(
      await this.get(`towns/${town}/duplicate-cases/${caseId}`)
    );
  }

  @Post(':caseId/decide')
  @UseGuards(AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard)
  @RequirePermissions(DIRECTORY_PERMISSIONS.review)
  @Header('Cache-Control', 'no-store')
  async decide(
    @Param('townId') town: string,
    @Param('caseId') caseId: string,
    @Body() body: any,
    @Req() req: RequestUser
  ): Promise<{ recorded: true; replayed: boolean; state: string }> {
    this.town(town);
    const actorId = this.reviewer(req);
    if (
      !uuid.test(caseId) ||
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      !actions.includes(body.action) ||
      typeof body.reason !== 'string' ||
      !body.reason.trim() ||
      body.reason.length > 1024 ||
      (body.expectedState !== undefined && !states.includes(body.expectedState))
    ) {
      throw new BadRequestException('Invalid duplicate decision');
    }
    const { base, secret } = this.config();
    const result = await this.send(
      `${base}/internal/local-evaluation/towns/${town}/duplicate-cases/${caseId}/decide`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: body.action,
          reason: body.reason,
          ...(body.expectedState === undefined
            ? {}
            : { expectedState: body.expectedState }),
          actorId,
        }),
      }
    );
    if (typeof result?.replayed !== 'boolean' || !states.includes(result.state))
      throw this.unavailable();
    return { recorded: true, replayed: result.replayed, state: result.state };
  }
}
