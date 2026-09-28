import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Inject,
  Logger,
  HttpStatus,
  HttpCode,
  Req,
  UseGuards,
  NotFoundException,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import {
  firstValueFrom,
  interval,
  Observable,
  startWith,
  switchMap,
} from 'rxjs';
import { filter, map } from 'rxjs/operators';
import {
  CIVIC_BROADCAST_ALERT,
  CIVIC_GET_AGENDAS,
  CIVIC_GET_BROADCASTS,
  CIVIC_GET_TIP_PROJECT,
  CIVIC_GET_TIP_PROJECTS,
  CIVIC_INGEST_AGENDA,
  CIVIC_IMPORT_AGENDA_SOURCE,
  CIVIC_REGISTER_TIP_PROJECT,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  CivicAgendaDto,
  EmergencyBroadcastDto,
  IngestAgendaDto,
  ImportAgendaSourceDto,
  PublishBroadcastDto,
  RegisterTipProjectDto,
  TipProjectSpatialDto,
} from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { TenantContextGuard } from '../../guards/tenant-context.guard';

type CivicRequest = {
  tenantId?: string;
  tenantContext?: unknown;
};

const CIVIC_STAFF_PERMISSION = 'civic.content.publish';
const BROADCAST_POLL_MS = 15000;

@ApiTags('civic')
@Controller(['v1/civic', 'civic'])
@UseGuards(TenantContextGuard)
export class CivicController {
  private readonly logger = new Logger(CivicController.name);

  constructor(
    @Inject(ServiceTokens.CIVIC_SERVICE)
    private readonly civicClient: ClientProxy
  ) {}

  @Get('agendas')
  @ApiOperation({ summary: 'Searchable municipal agenda archive' })
  @ApiResponse({
    status: 200,
    description: 'Agendas with line items',
    type: [CivicAgendaDto],
  })
  async getAgendas(
    @Query('meetingBody') meetingBody: string | undefined,
    @Query('search') search: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: CivicRequest
  ): Promise<CivicAgendaDto[]> {
    return firstValueFrom(
      this.civicClient.send<CivicAgendaDto[]>(CIVIC_GET_AGENDAS, {
        tenantId: this.requireTenantId(req),
        meetingBody,
        search,
        limit: limit ? parseInt(limit, 10) : undefined,
      })
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(CIVIC_STAFF_PERMISSION)
  @Post('agendas/ingest')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ingest a meeting agenda PDF into line items' })
  @ApiResponse({
    status: 201,
    description: 'Ingested agenda',
    type: CivicAgendaDto,
  })
  async ingestAgenda(
    @Body() dto: IngestAgendaDto,
    @Req() req: CivicRequest
  ): Promise<CivicAgendaDto> {
    return firstValueFrom(
      this.civicClient.send<CivicAgendaDto>(CIVIC_INGEST_AGENDA, {
        tenantId: this.requireTenantId(req),
        ...(dto ?? {}),
      })
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(CIVIC_STAFF_PERMISSION)
  @Post('agendas/import-source')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Import an agenda PDF from a configured official source URL',
  })
  @ApiResponse({ status: 201, description: 'Imported agenda' })
  async importAgendaSource(
    @Body() dto: ImportAgendaSourceDto,
    @Req() req: CivicRequest
  ): Promise<CivicAgendaDto> {
    return firstValueFrom(
      this.civicClient.send<CivicAgendaDto>(CIVIC_IMPORT_AGENDA_SOURCE, {
        tenantId: this.requireTenantId(req),
        ...(dto ?? {}),
      })
    );
  }

  @Get('tip-projects')
  @ApiOperation({ summary: 'Spatial TIP project query' })
  @ApiResponse({
    status: 200,
    description: 'TIP projects with geometries',
    type: [TipProjectSpatialDto],
  })
  async getTipProjects(
    @Query('bbox') bbox: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: CivicRequest
  ): Promise<TipProjectSpatialDto[]> {
    return firstValueFrom(
      this.civicClient.send<TipProjectSpatialDto[]>(CIVIC_GET_TIP_PROJECTS, {
        tenantId: this.requireTenantId(req),
        bbox: this.parseBbox(bbox),
        limit: limit ? parseInt(limit, 10) : undefined,
      })
    );
  }

  @Get('tip-projects/:id')
  @ApiOperation({ summary: 'Get one TIP project with funding detail' })
  @ApiResponse({
    status: 200,
    description: 'TIP project',
    type: TipProjectSpatialDto,
  })
  async getTipProject(
    @Param('id') id: string,
    @Req() req: CivicRequest
  ): Promise<TipProjectSpatialDto> {
    return firstValueFrom(
      this.civicClient.send<TipProjectSpatialDto>(CIVIC_GET_TIP_PROJECT, {
        tenantId: this.requireTenantId(req),
        id,
      })
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(CIVIC_STAFF_PERMISSION)
  @Post('tip-projects')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a TIP project with geometry' })
  @ApiResponse({
    status: 201,
    description: 'Registered TIP project',
    type: TipProjectSpatialDto,
  })
  async registerTipProject(
    @Body() dto: RegisterTipProjectDto,
    @Req() req: CivicRequest
  ): Promise<TipProjectSpatialDto> {
    return firstValueFrom(
      this.civicClient.send<TipProjectSpatialDto>(CIVIC_REGISTER_TIP_PROJECT, {
        tenantId: this.requireTenantId(req),
        ...(dto ?? {}),
      })
    );
  }

  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions(CIVIC_STAFF_PERMISSION)
  @Post('broadcasts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Publish an emergency broadcast' })
  @ApiResponse({
    status: 201,
    description: 'Published broadcast',
    type: EmergencyBroadcastDto,
  })
  async publishBroadcast(
    @Body() dto: PublishBroadcastDto,
    @Req() req: CivicRequest
  ): Promise<EmergencyBroadcastDto> {
    return firstValueFrom(
      this.civicClient.send<EmergencyBroadcastDto>(CIVIC_BROADCAST_ALERT, {
        tenantId: this.requireTenantId(req),
        ...(dto ?? {}),
      })
    );
  }

  @Sse('broadcasts/stream')
  @ApiOperation({
    summary: 'Server-Sent Events stream of active emergency broadcasts',
  })
  streamBroadcasts(@Req() req: CivicRequest): Observable<MessageEvent> {
    const tenantId = this.requireTenantId(req);
    let lastSeenIds = new Set<string>();
    let lastTotal: number | null = null;
    return interval(BROADCAST_POLL_MS).pipe(
      startWith(0),
      switchMap(() =>
        this.civicClient.send<EmergencyBroadcastDto[]>(CIVIC_GET_BROADCASTS, {
          tenantId,
          limit: 50,
        })
      ),
      map((broadcasts) => {
        const current = broadcasts ?? [];
        const fresh = current.filter(
          (broadcast) => broadcast && !lastSeenIds.has(broadcast.id)
        );
        lastSeenIds = new Set(current.map((item) => item.id));
        const changed = lastTotal === null || current.length !== lastTotal;
        lastTotal = current.length;
        return { current, fresh, changed };
      }),
      filter(({ current, fresh, changed }) => changed || fresh.length > 0),
      map(
        ({ current, fresh }) =>
          ({
            data: { broadcasts: current, fresh },
          } as MessageEvent)
      )
    );
  }

  private parseBbox(
    bbox: string | undefined
  ): [number, number, number, number] | undefined {
    if (bbox === undefined || bbox.trim() === '') {
      return undefined;
    }
    const parts = bbox.split(',').map((part) => Number(part.trim()));
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
      throw new BadRequestException(
        'bbox must be four comma-separated finite numbers.'
      );
    }
    return parts as [number, number, number, number];
  }

  private requireTenantId(req: CivicRequest): string {
    if (!req?.tenantId) {
      throw new NotFoundException('Tenant context is required');
    }
    return req.tenantId;
  }
}
