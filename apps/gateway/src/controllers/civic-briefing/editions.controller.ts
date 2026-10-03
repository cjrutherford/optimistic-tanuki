import {
  Controller,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Param,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CivicBriefingCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import type {
  EditionHistory,
  EditionSummary,
  PublishedBriefing,
} from '@optimistic-tanuki/models';
import { firstValueFrom, timeout } from 'rxjs';
import { Public } from '../../decorators/public.decorator';

/** How long a briefing read may take before the gateway gives up. */
const READ_TIMEOUT_MS = 10_000;

/**
 * Published briefings, for anyone (plan slice P3.1). A briefing is a public
 * document: these routes need no account, as in the Daylight POC.
 */
@Public()
@ApiTags('civic-briefing')
@Controller(['v1/local-hub/editions', 'local-hub/editions'])
export class EditionsController {
  private readonly logger = new Logger(EditionsController.name);

  constructor(
    @Inject(ServiceTokens.CIVIC_BRIEFING_SERVICE)
    private readonly briefings: ClientProxy
  ) {}

  @Get()
  @ApiOperation({ summary: 'Every town with a published briefing' })
  async editions(): Promise<{ data: EditionSummary[] }> {
    return {
      data: await this.read<EditionSummary[]>(
        CivicBriefingCommands.EDITIONS,
        {}
      ),
    };
  }

  @Get(':slug')
  @ApiOperation({ summary: "A town's recent editions, newest first" })
  async edition(
    @Param('slug') slug: string
  ): Promise<{ data: EditionHistory }> {
    const history = await this.read<EditionHistory | null>(
      CivicBriefingCommands.EDITION_HISTORY,
      { slug }
    );
    if (!history) throw new NotFoundException(`No briefings for ${slug}.`);
    return { data: history };
  }

  @Get(':slug/briefings/latest')
  @ApiOperation({ summary: "A town's newest briefing" })
  async latest(
    @Param('slug') slug: string
  ): Promise<{ data: PublishedBriefing }> {
    return { data: await this.found(slug) };
  }

  @Get(':slug/briefings/:periodEnd')
  @ApiOperation({
    summary: "A town's briefing for the period ending on a date",
  })
  async briefing(
    @Param('slug') slug: string,
    @Param('periodEnd') periodEnd: string
  ): Promise<{ data: PublishedBriefing }> {
    return { data: await this.found(slug, periodEnd) };
  }

  private async found(
    slug: string,
    periodEnd?: string
  ): Promise<PublishedBriefing> {
    const briefing = await this.read<PublishedBriefing | null>(
      CivicBriefingCommands.BRIEFING,
      { slug, ...(periodEnd ? { periodEnd } : {}) }
    );
    if (!briefing) {
      throw new NotFoundException(
        periodEnd
          ? `No briefing for ${slug} on ${periodEnd}.`
          : `No briefings for ${slug}.`
      );
    }
    return briefing;
  }

  private async read<T>(cmd: string, payload: object): Promise<T> {
    try {
      return await firstValueFrom(
        this.briefings.send<T>({ cmd }, payload).pipe(timeout(READ_TIMEOUT_MS))
      );
    } catch (error) {
      this.logger.warn(
        `civic-briefing ${cmd} failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw new ServiceUnavailableException(
        'Briefings are unavailable right now.'
      );
    }
  }
}
