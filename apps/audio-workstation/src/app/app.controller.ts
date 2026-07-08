import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import {
  AudioProjectCommands,
  TrackCommands,
  MixCommands,
  GenerationCommands,
  ExportCommands,
} from '@optimistic-tanuki/constants';
import {
  CreateAudioProjectDto,
  UpdateAudioProjectDto,
  CreateTrackDto,
  UpdateTrackDto,
  RequestGenerationDto,
  SaveMixDto,
  StartExportDto,
} from '@optimistic-tanuki/models';
import { ProjectService } from './services/project.service';
import { TrackService } from './services/track.service';
import { GenerationService } from './services/generation.service';
import { MixService } from './services/mix.service';
import { ExportService } from './services/export.service';

@Controller()
export class AppController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly trackService: TrackService,
    private readonly generationService: GenerationService,
    private readonly mixService: MixService,
    private readonly exportService: ExportService
  ) {}

  @MessagePattern({ cmd: AudioProjectCommands.CREATE })
  async createProject(
    @Payload('userId') userId: string,
    @Payload('data') data: CreateAudioProjectDto
  ) {
    return this.projectService.create(userId, data);
  }

  @MessagePattern({ cmd: AudioProjectCommands.GET })
  async getProject(
    @Payload('id') id: string,
    @Payload('userId') userId: string
  ) {
    return this.projectService.findById(id, userId);
  }

  @MessagePattern({ cmd: AudioProjectCommands.UPDATE })
  async updateProject(
    @Payload('id') id: string,
    @Payload('userId') userId: string,
    @Payload('data') data: UpdateAudioProjectDto
  ) {
    return this.projectService.update(id, userId, data);
  }

  @MessagePattern({ cmd: AudioProjectCommands.DELETE })
  async deleteProject(
    @Payload('id') id: string,
    @Payload('userId') userId: string
  ) {
    return this.projectService.delete(id, userId);
  }

  @MessagePattern({ cmd: AudioProjectCommands.LIST })
  async listProjects(@Payload('userId') userId: string) {
    return this.projectService.findByUser(userId);
  }

  @MessagePattern({ cmd: TrackCommands.CREATE })
  async createTrack(@Payload() data: CreateTrackDto) {
    return this.trackService.create(data);
  }

  @MessagePattern({ cmd: TrackCommands.LIST })
  async listTracks(@Payload('projectId') projectId: string) {
    return this.trackService.findByProject(projectId);
  }

  @MessagePattern({ cmd: TrackCommands.UPDATE })
  async updateTrack(
    @Payload('id') id: string,
    @Payload('data') data: UpdateTrackDto
  ) {
    return this.trackService.update(id, data);
  }

  @MessagePattern({ cmd: TrackCommands.DELETE })
  async deleteTrack(@Payload('id') id: string) {
    return this.trackService.delete(id);
  }

  @MessagePattern({ cmd: GenerationCommands.REQUEST })
  async requestGeneration(
    @Payload('userId') userId: string,
    @Payload('data') data: RequestGenerationDto
  ) {
    return this.generationService.requestGeneration(userId, data);
  }

  @MessagePattern({ cmd: GenerationCommands.STATUS })
  async getGenerationStatus(@Payload('id') id: string) {
    return this.generationService.getStatus(id);
  }

  @MessagePattern({ cmd: GenerationCommands.LIST })
  async listGenerations(@Payload('projectId') projectId: string) {
    return this.generationService.listByProject(projectId);
  }

  @MessagePattern({ cmd: GenerationCommands.CANCEL })
  async cancelGeneration(@Payload('id') id: string) {
    return this.generationService.cancel(id);
  }

  @MessagePattern({ cmd: MixCommands.SAVE })
  async saveMix(
    @Payload('userId') userId: string,
    @Payload('data') data: SaveMixDto
  ) {
    return this.mixService.save(userId, data);
  }

  @MessagePattern({ cmd: MixCommands.GET })
  async getMix(
    @Payload('projectId') projectId: string,
    @Payload('trackId') trackId: string
  ) {
    return this.mixService.findByTrack(projectId, trackId);
  }

  @MessagePattern({ cmd: MixCommands.LIST })
  async listMixes(@Payload('projectId') projectId: string) {
    return this.mixService.findByProject(projectId);
  }

  @MessagePattern({ cmd: ExportCommands.START })
  async startExport(
    @Payload('userId') userId: string,
    @Payload('projectId') projectId: string,
    @Payload('data') data: StartExportDto
  ) {
    return this.exportService.start(userId, projectId, data);
  }

  @MessagePattern({ cmd: ExportCommands.STATUS })
  async getExportStatus(@Payload('id') id: string) {
    return this.exportService.getStatus(id);
  }

  @MessagePattern({ cmd: ExportCommands.LIST })
  async listExports(@Payload('projectId') projectId: string) {
    return this.exportService.listByProject(projectId);
  }
}
