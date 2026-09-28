import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Inject,
  Logger,
  HttpStatus,
  HttpCode,
  Req,
  Res,
  UseGuards,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Response } from 'express';
import {
  NEXUS_CREATE_MILESTONE,
  NEXUS_GET_CHANGE_ORDERS,
  NEXUS_GET_CHANGE_ORDER_DOCUMENT,
  NEXUS_GET_DRAWINGS,
  NEXUS_GET_MILESTONES,
  NEXUS_REGISTER_DRAWING,
  NEXUS_SUBMIT_CHANGE_ORDER,
  NEXUS_UPDATE_MILESTONE,
  NEXUS_UPLOAD_INSPECTION_PHOTO,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  ChangeOrderResponseDto,
  ChangeOrderSubmissionDto,
  CreateMilestoneDto,
  DrawingManifestDto,
  InspectionPhotoResponseDto,
  InspectionPhotoUploadDto,
  ProjectMilestoneDto,
  RegisterDrawingDto,
  UpdateMilestoneDto,
} from '@optimistic-tanuki/models';
import { AuthGuard } from '../../auth/auth.guard';
import { TenantContextGuard } from '../../guards/tenant-context.guard';

type NexusRequest = {
  tenantId?: string;
  tenantContext?: unknown;
};

@ApiTags('nexus')
@Controller(['v1/nexus', 'nexus'])
@UseGuards(TenantContextGuard, AuthGuard)
export class NexusController {
  private readonly logger = new Logger(NexusController.name);

  constructor(
    @Inject(ServiceTokens.PROJECT_PLANNING_SERVICE)
    private readonly projectPlanningClient: ClientProxy
  ) {}

  @Get('projects/:id/milestones')
  @ApiOperation({ summary: 'Get commercial construction phase schedule' })
  @ApiResponse({
    status: 200,
    description: 'Milestones with delay alerts',
    type: [ProjectMilestoneDto],
  })
  async getMilestones(
    @Param('id') projectId: string,
    @Req() req: NexusRequest
  ): Promise<ProjectMilestoneDto[]> {
    this.logger.log(`Retrieving milestones for project ${projectId}`);
    return firstValueFrom(
      this.projectPlanningClient.send<ProjectMilestoneDto[]>(
        NEXUS_GET_MILESTONES,
        { tenantId: this.requireTenantId(req), projectId }
      )
    );
  }

  @Patch('projects/:id/milestones/:mId')
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiOperation({ summary: 'Update a construction milestone' })
  @ApiResponse({
    status: 200,
    description: 'Updated milestone',
    type: ProjectMilestoneDto,
  })
  async updateMilestone(
    @Param('mId') milestoneId: string,
    @Body() dto: UpdateMilestoneDto & { predecessorIds?: string[] },
    @Req() req: NexusRequest
  ): Promise<ProjectMilestoneDto> {
    return firstValueFrom(
      this.projectPlanningClient.send<ProjectMilestoneDto>(
        NEXUS_UPDATE_MILESTONE,
        { tenantId: this.requireTenantId(req), id: milestoneId, ...(dto ?? {}) }
      )
    );
  }

  @Post('projects/:id/milestones')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule a construction milestone' })
  @ApiResponse({
    status: 201,
    description: 'Created milestone',
    type: ProjectMilestoneDto,
  })
  async createMilestone(
    @Param('id') projectId: string,
    @Body() dto: CreateMilestoneDto,
    @Req() req: NexusRequest
  ): Promise<ProjectMilestoneDto> {
    return firstValueFrom(
      this.projectPlanningClient.send<ProjectMilestoneDto>(
        NEXUS_CREATE_MILESTONE,
        {
          tenantId: this.requireTenantId(req),
          projectId,
          ...(dto ?? {}),
        }
      )
    );
  }

  @Get('projects/:id/drawings')
  @ApiOperation({
    summary: 'Get blueprint and permit manifest with COI status',
  })
  @ApiResponse({
    status: 200,
    description: 'Drawing manifest',
    type: DrawingManifestDto,
  })
  async getDrawings(
    @Param('id') projectId: string,
    @Req() req: NexusRequest
  ): Promise<DrawingManifestDto> {
    return firstValueFrom(
      this.projectPlanningClient.send<DrawingManifestDto>(NEXUS_GET_DRAWINGS, {
        tenantId: this.requireTenantId(req),
        projectId,
      })
    );
  }

  @Post('projects/:id/photos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a jobsite inspection photo with GPS proof' })
  @ApiResponse({
    status: 201,
    description: 'Sealed inspection photo receipt',
    type: InspectionPhotoResponseDto,
  })
  async uploadPhoto(
    @Param('id') projectId: string,
    @Body() dto: InspectionPhotoUploadDto,
    @Req() req: NexusRequest
  ): Promise<InspectionPhotoResponseDto> {
    return firstValueFrom(
      this.projectPlanningClient.send<InspectionPhotoResponseDto>(
        NEXUS_UPLOAD_INSPECTION_PHOTO,
        {
          tenantId: this.requireTenantId(req),
          ...(dto ?? {}),
          projectId,
        }
      )
    );
  }

  @Post('projects/:id/drawings')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a drawing set revision' })
  @ApiResponse({
    status: 201,
    description: 'Updated drawing manifest',
    type: DrawingManifestDto,
  })
  async registerDrawing(
    @Param('id') projectId: string,
    @Body() dto: RegisterDrawingDto,
    @Req() req: NexusRequest
  ): Promise<DrawingManifestDto> {
    return firstValueFrom(
      this.projectPlanningClient.send<DrawingManifestDto>(
        NEXUS_REGISTER_DRAWING,
        {
          tenantId: this.requireTenantId(req),
          projectId,
          ...(dto ?? {}),
        }
      )
    );
  }

  @Post('projects/:id/change-orders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a digital change order for approval' })
  @ApiResponse({
    status: 201,
    description: 'Submitted change order',
    type: ChangeOrderResponseDto,
  })
  async submitChangeOrder(
    @Param('id') projectId: string,
    @Body() dto: ChangeOrderSubmissionDto,
    @Req() req: NexusRequest
  ): Promise<ChangeOrderResponseDto> {
    return firstValueFrom(
      this.projectPlanningClient.send<ChangeOrderResponseDto>(
        NEXUS_SUBMIT_CHANGE_ORDER,
        {
          tenantId: this.requireTenantId(req),
          ...(dto ?? {}),
          projectId,
        }
      )
    );
  }

  @Get('projects/:id/change-orders')
  @ApiOperation({ summary: 'List change orders with approval state' })
  @ApiResponse({
    status: 200,
    description: 'Change orders',
    type: [ChangeOrderResponseDto],
  })
  async getChangeOrders(
    @Param('id') projectId: string,
    @Req() req: NexusRequest
  ): Promise<ChangeOrderResponseDto[]> {
    return firstValueFrom(
      this.projectPlanningClient.send<ChangeOrderResponseDto[]>(
        NEXUS_GET_CHANGE_ORDERS,
        { tenantId: this.requireTenantId(req), projectId }
      )
    );
  }

  @Post('projects/:id/change-orders/:coId/transition')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiParam({ name: 'coId', description: 'Change order ID' })
  @ApiOperation({ summary: 'Advance a change order through approval' })
  @ApiResponse({
    status: 200,
    description: 'Transitioned change order',
    type: ChangeOrderResponseDto,
  })
  async transitionChangeOrder(
    @Param('coId') changeOrderId: string,
    @Body() dto: { transition?: string },
    @Req() req: NexusRequest
  ): Promise<ChangeOrderResponseDto> {
    if (!dto?.transition) {
      throw new BadRequestException('A transition is required.');
    }
    return firstValueFrom(
      this.projectPlanningClient.send<ChangeOrderResponseDto>(
        NEXUS_SUBMIT_CHANGE_ORDER,
        {
          tenantId: this.requireTenantId(req),
          id: changeOrderId,
          transition: dto.transition,
        }
      )
    );
  }

  @Get('projects/:id/change-orders/:coId/document')
  @ApiParam({ name: 'id', description: 'Project ID' })
  @ApiParam({ name: 'coId', description: 'Change order ID' })
  @ApiOperation({ summary: 'Download the signed change order PDF' })
  @ApiResponse({ status: 200, description: 'Signed PDF summary' })
  async downloadChangeOrderDocument(
    @Param('coId') changeOrderId: string,
    @Req() req: NexusRequest,
    @Res() response: Response
  ): Promise<void> {
    const document = await firstValueFrom(
      this.projectPlanningClient.send<{
        fileName: string;
        mimeType: string;
        fileBase64: string;
      }>(NEXUS_GET_CHANGE_ORDER_DOCUMENT, {
        tenantId: this.requireTenantId(req),
        id: changeOrderId,
      })
    );
    if (!document || typeof document.fileBase64 !== 'string') {
      throw new ServiceUnavailableException(
        'The signed change order document is unavailable.'
      );
    }
    const body = Buffer.from(document.fileBase64, 'base64');
    response.setHeader('Content-Type', document.mimeType || 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${document.fileName || 'change-order.pdf'}"`
    );
    response.setHeader('Content-Length', body.byteLength);
    response.setHeader('Cache-Control', 'no-store');
    response.send(body);
  }

  private requireTenantId(req: NexusRequest): string {
    if (!req?.tenantId) {
      throw new NotFoundException('Tenant context is required');
    }
    return req.tenantId;
  }
}
