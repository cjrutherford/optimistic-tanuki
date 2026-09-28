import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CIVIC_BROADCAST_ALERT,
  CIVIC_GET_AGENDAS,
  CIVIC_GET_BROADCASTS,
  CIVIC_GET_TIP_PROJECT,
  CIVIC_GET_TIP_PROJECTS,
  CIVIC_INGEST_AGENDA,
  CIVIC_IMPORT_AGENDA_SOURCE,
  CIVIC_REGISTER_TIP_PROJECT,
} from '@optimistic-tanuki/constants';
import {
  IngestAgendaDto,
  ImportAgendaSourceDto,
  PublishBroadcastDto,
  RegisterTipProjectDto,
} from '@optimistic-tanuki/models';
import { CivicService } from './civic.service';

@Controller()
export class CivicController {
  constructor(private readonly civicService: CivicService) {}

  @MessagePattern(CIVIC_GET_AGENDAS)
  async getAgendas(
    @Payload()
    payload: {
      tenantId: string;
      meetingBody?: string;
      search?: string;
      limit?: number;
    }
  ) {
    return this.civicService.getAgendas(payload?.tenantId, {
      meetingBody: payload?.meetingBody,
      search: payload?.search,
      limit: payload?.limit,
    });
  }

  @MessagePattern(CIVIC_INGEST_AGENDA)
  async ingestAgenda(
    @Payload()
    payload: { tenantId: string } & IngestAgendaDto
  ) {
    const { tenantId, ...dto } = (payload ?? {}) as {
      tenantId: string;
    } & IngestAgendaDto;
    return this.civicService.ingestAgenda(tenantId, dto);
  }

  @MessagePattern(CIVIC_IMPORT_AGENDA_SOURCE)
  async importAgendaSource(
    @Payload() payload: { tenantId: string } & ImportAgendaSourceDto
  ) {
    const { tenantId, ...dto } = (payload ?? {}) as {
      tenantId: string;
    } & ImportAgendaSourceDto;
    return this.civicService.importAgendaSource(tenantId, dto);
  }

  @MessagePattern(CIVIC_GET_TIP_PROJECTS)
  async getTipProjects(
    @Payload()
    payload: {
      tenantId: string;
      bbox?: [number, number, number, number];
      limit?: number;
    }
  ) {
    return this.civicService.getTipProjects(payload?.tenantId, {
      bbox: payload?.bbox,
      limit: payload?.limit,
    });
  }

  @MessagePattern(CIVIC_GET_TIP_PROJECT)
  async getTipProject(@Payload() payload: { tenantId: string; id: string }) {
    return this.civicService.getTipProject(payload?.tenantId, payload?.id);
  }

  @MessagePattern(CIVIC_REGISTER_TIP_PROJECT)
  async registerTipProject(
    @Payload()
    payload: { tenantId: string } & RegisterTipProjectDto
  ) {
    const { tenantId, ...dto } = (payload ?? {}) as {
      tenantId: string;
    } & RegisterTipProjectDto;
    return this.civicService.registerTipProject(tenantId, dto);
  }

  @MessagePattern(CIVIC_BROADCAST_ALERT)
  async publishBroadcast(
    @Payload()
    payload: { tenantId: string } & PublishBroadcastDto
  ) {
    const { tenantId, ...dto } = (payload ?? {}) as {
      tenantId: string;
    } & PublishBroadcastDto;
    return this.civicService.publishBroadcast(tenantId, dto);
  }

  @MessagePattern(CIVIC_GET_BROADCASTS)
  async getBroadcasts(
    @Payload() payload: { tenantId: string; since?: string; limit?: number }
  ) {
    return this.civicService.getBroadcasts(payload?.tenantId, {
      since: payload?.since,
      limit: payload?.limit,
    });
  }
}
