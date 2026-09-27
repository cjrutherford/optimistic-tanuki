import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
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
} from '@optimistic-tanuki/constants';
import {
  ChangeOrderSubmissionDto,
  CreateMilestoneDto,
  InspectionPhotoUploadDto,
  RegisterDrawingDto,
  UpdateMilestoneDto,
} from '@optimistic-tanuki/models';
import { NexusService } from './nexus.service';

@Controller()
export class NexusController {
  constructor(private readonly nexusService: NexusService) {}

  @MessagePattern(NEXUS_GET_MILESTONES)
  async getMilestones(
    @Payload() payload: { tenantId: string; projectId: string }
  ) {
    return this.nexusService.getMilestones(
      payload?.tenantId,
      payload?.projectId
    );
  }

  @MessagePattern(NEXUS_CREATE_MILESTONE)
  async createMilestone(
    @Payload()
    payload: { tenantId: string; projectId: string } & CreateMilestoneDto
  ) {
    const { tenantId, projectId, ...dto } = (payload ?? {}) as {
      tenantId: string;
      projectId: string;
    } & CreateMilestoneDto;
    return this.nexusService.createMilestone(tenantId, projectId, dto);
  }

  @MessagePattern(NEXUS_UPDATE_MILESTONE)
  async updateMilestone(
    @Payload()
    payload: { tenantId: string; id: string } & UpdateMilestoneDto & {
        predecessorIds?: string[];
      }
  ) {
    const { tenantId, id, predecessorIds, ...patch } = payload ?? {};
    if (predecessorIds !== undefined) {
      return this.nexusService.setMilestonePredecessors(
        tenantId,
        id,
        predecessorIds
      );
    }
    return this.nexusService.updateMilestone(tenantId, id, patch);
  }

  @MessagePattern(NEXUS_GET_DRAWINGS)
  async getDrawings(
    @Payload() payload: { tenantId: string; projectId: string }
  ) {
    return this.nexusService.getDrawings(payload?.tenantId, payload?.projectId);
  }

  @MessagePattern(NEXUS_REGISTER_DRAWING)
  async registerDrawing(
    @Payload()
    payload: { tenantId: string; projectId: string } & RegisterDrawingDto
  ) {
    const { tenantId, projectId, ...dto } = (payload ?? {}) as {
      tenantId: string;
      projectId: string;
    } & RegisterDrawingDto;
    return this.nexusService.registerDrawing(tenantId, projectId, dto);
  }

  @MessagePattern(NEXUS_SUBMIT_CHANGE_ORDER)
  async submitChangeOrder(
    @Payload()
    payload: { tenantId: string } & (
      | ChangeOrderSubmissionDto
      | { id: string; transition: string }
    )
  ) {
    const { tenantId, ...body } = payload ?? {};
    if (
      typeof (body as { id?: unknown }).id === 'string' &&
      typeof (body as { transition?: unknown }).transition === 'string'
    ) {
      return this.nexusService.transitionChangeOrder(
        tenantId,
        (body as { id: string }).id,
        (body as { transition: string }).transition
      );
    }
    return this.nexusService.submitChangeOrder(
      tenantId,
      body as ChangeOrderSubmissionDto
    );
  }

  @MessagePattern(NEXUS_GET_CHANGE_ORDERS)
  async getChangeOrders(
    @Payload() payload: { tenantId: string; projectId: string }
  ) {
    return this.nexusService.getChangeOrders(
      payload?.tenantId,
      payload?.projectId
    );
  }

  @MessagePattern(NEXUS_UPLOAD_INSPECTION_PHOTO)
  async uploadInspectionPhoto(
    @Payload()
    payload: { tenantId: string } & InspectionPhotoUploadDto
  ) {
    const { tenantId, ...upload } = (payload ?? {}) as {
      tenantId: string;
    } & InspectionPhotoUploadDto;
    return this.nexusService.uploadInspectionPhoto(tenantId, upload);
  }

  @MessagePattern(NEXUS_GET_CHANGE_ORDER_DOCUMENT)
  async getChangeOrderDocument(
    @Payload() payload: { tenantId: string; id: string }
  ) {
    return this.nexusService.getChangeOrderDocument(
      payload?.tenantId,
      payload?.id
    );
  }
}
