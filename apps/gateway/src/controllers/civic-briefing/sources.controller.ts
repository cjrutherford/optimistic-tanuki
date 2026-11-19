import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  CivicBriefingCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';
import { Public } from '../../decorators/public.decorator';
import { User, type UserDetails } from '../../decorators/user.decorator';
import {
  SourceRequestBody,
  SourceRequestReply,
  SourceStatusReply,
} from './replies';

/** How long a read may take before the gateway gives up. */
const READ_TIMEOUT_MS = 10_000;

/** The longest note a request may carry, after trimming. */
export const MAX_NOTE_LENGTH = 500;

/**
 * Whether a town has sources, and readers' requests for them (D32). The
 * status is public, like the briefing it stands in for; a request needs an
 * account, so one reader cannot inflate a town's count.
 */
@ApiTags('civic-briefing')
@Controller(['v1/local-hub/localities', 'local-hub/localities'])
export class SourcesController {
  private readonly logger = new Logger(SourcesController.name);

  constructor(
    @Inject(ServiceTokens.CIVIC_BRIEFING_SERVICE)
    private readonly briefings: ClientProxy
  ) {}

  @Public()
  @Get(':slug/source-status')
  @ApiOperation({ summary: 'Whether a town has sources, and how many ask' })
  @ApiResponse({ status: 200, type: SourceStatusReply })
  @ApiResponse({ status: 404, description: 'Unknown or inactive town' })
  async status(@Param('slug') slug: string): Promise<SourceStatusReply> {
    const status = await this.read<SourceStatusReply | null>(
      CivicBriefingCommands.SOURCE_STATUS,
      { slug }
    );
    if (!status) throw new NotFoundException(`No town ${slug}.`);
    return status;
  }

  @UseGuards(AuthGuard)
  @Post(':slug/source-requests')
  @HttpCode(201)
  @ApiOperation({ summary: 'Ask for sources for a town; once per reader' })
  @ApiResponse({ status: 201, type: SourceRequestReply })
  @ApiResponse({ status: 400, description: 'The note is over 500 characters' })
  @ApiResponse({ status: 404, description: 'Unknown or inactive town' })
  async request(
    @Param('slug') slug: string,
    @Body() body: SourceRequestBody,
    @User() user: UserDetails
  ): Promise<SourceRequestReply> {
    const note = body?.note?.trim() || undefined;
    if (note && note.length > MAX_NOTE_LENGTH)
      throw new BadRequestException(
        `The note is limited to ${MAX_NOTE_LENGTH} characters.`
      );
    const reply = await this.read<SourceRequestReply | null>(
      CivicBriefingCommands.REQUEST_SOURCES,
      { slug, userId: user.userId, ...(note ? { note } : {}) }
    );
    if (!reply) throw new NotFoundException(`No town ${slug}.`);
    return reply;
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
        'Sources are unavailable right now.'
      );
    }
  }
}
