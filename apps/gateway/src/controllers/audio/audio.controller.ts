import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Inject,
  Req,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { AuthGuard } from '../../auth/auth.guard';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import {
  AudioProjectCommands,
  TrackCommands,
  GenerationCommands,
  MixCommands,
  ExportCommands,
} from '@optimistic-tanuki/constants';
import type { Request } from 'express';

@UseGuards(AuthGuard)
@Controller('audio')
export class AudioController {
  constructor(
    @Inject(ServiceTokens.AUDIO_WORKSTATION_SERVICE)
    private readonly audioWorkstation: ClientProxy
  ) {}

  private getUserId(req: Request): string {
    return (req as any).user?.userId || 'anonymous';
  }

  @Post('projects')
  async createProject(@Req() req: Request, @Body() body: any) {
    return firstValueFrom(
      this.audioWorkstation.send(
        { cmd: AudioProjectCommands.CREATE },
        { userId: this.getUserId(req), data: body }
      )
    );
  }

  @Get('projects')
  async listProjects(@Req() req: Request) {
    return firstValueFrom(
      this.audioWorkstation.send(
        { cmd: AudioProjectCommands.LIST },
        { userId: this.getUserId(req) }
      )
    );
  }

  @Get('projects/:id')
  async getProject(@Req() req: Request, @Param('id') id: string) {
    return firstValueFrom(
      this.audioWorkstation.send(
        { cmd: AudioProjectCommands.GET },
        { id, userId: this.getUserId(req) }
      )
    );
  }

  @Patch('projects/:id')
  async updateProject(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: any
  ) {
    return firstValueFrom(
      this.audioWorkstation.send(
        { cmd: AudioProjectCommands.UPDATE },
        { id, userId: this.getUserId(req), data: body }
      )
    );
  }

  @Delete('projects/:id')
  async deleteProject(@Req() req: Request, @Param('id') id: string) {
    return firstValueFrom(
      this.audioWorkstation.send(
        { cmd: AudioProjectCommands.DELETE },
        { id, userId: this.getUserId(req) }
      )
    );
  }

  @Get('projects/:id/tracks')
  async listTracks(@Param('id') projectId: string) {
    return firstValueFrom(
      this.audioWorkstation.send({ cmd: TrackCommands.LIST }, { projectId })
    );
  }

  @Post('projects/:id/tracks')
  async createTrack(@Param('id') projectId: string, @Body() body: any) {
    return firstValueFrom(
      this.audioWorkstation.send(
        { cmd: TrackCommands.CREATE },
        { ...body, projectId }
      )
    );
  }

  @Patch('tracks/:id')
  async updateTrack(@Param('id') id: string, @Body() body: any) {
    return firstValueFrom(
      this.audioWorkstation.send(
        { cmd: TrackCommands.UPDATE },
        { id, data: body }
      )
    );
  }

  @Delete('tracks/:id')
  async deleteTrack(@Param('id') id: string) {
    return firstValueFrom(
      this.audioWorkstation.send({ cmd: TrackCommands.DELETE }, { id })
    );
  }

  @Post('projects/:id/generate')
  async requestGeneration(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Body() body: any
  ) {
    return firstValueFrom(
      this.audioWorkstation.send(
        { cmd: GenerationCommands.REQUEST },
        { userId: this.getUserId(req), data: { ...body, projectId } }
      )
    );
  }

  @Get('generations/:requestId')
  async getGenerationStatus(@Param('requestId') requestId: string) {
    return firstValueFrom(
      this.audioWorkstation.send(
        { cmd: GenerationCommands.STATUS },
        { id: requestId }
      )
    );
  }

  @Get('projects/:id/generations')
  async listGenerations(@Param('id') projectId: string) {
    return firstValueFrom(
      this.audioWorkstation.send(
        { cmd: GenerationCommands.LIST },
        { projectId }
      )
    );
  }

  @Post('generations/:requestId/cancel')
  async cancelGeneration(@Param('requestId') requestId: string) {
    return firstValueFrom(
      this.audioWorkstation.send(
        { cmd: GenerationCommands.CANCEL },
        { id: requestId }
      )
    );
  }

  @Get('projects/:id/mix')
  async getMix(@Param('id') projectId: string) {
    return firstValueFrom(
      this.audioWorkstation.send({ cmd: MixCommands.LIST }, { projectId })
    );
  }

  @Put('projects/:id/mix/:trackId')
  async saveMix(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Param('trackId') trackId: string,
    @Body() body: any
  ) {
    return firstValueFrom(
      this.audioWorkstation.send(
        { cmd: MixCommands.SAVE },
        { userId: this.getUserId(req), data: { projectId, trackId, ...body } }
      )
    );
  }

  @Post('projects/:id/export')
  async startExport(
    @Req() req: Request,
    @Param('id') projectId: string,
    @Body() body: any
  ) {
    return firstValueFrom(
      this.audioWorkstation.send(
        { cmd: ExportCommands.START },
        { userId: this.getUserId(req), projectId, data: body }
      )
    );
  }

  @Get('exports/:exportId')
  async getExportStatus(@Param('exportId') exportId: string) {
    return firstValueFrom(
      this.audioWorkstation.send(
        { cmd: ExportCommands.STATUS },
        { id: exportId }
      )
    );
  }

  @Get('projects/:id/exports')
  async listExports(@Param('id') projectId: string) {
    return firstValueFrom(
      this.audioWorkstation.send({ cmd: ExportCommands.LIST }, { projectId })
    );
  }
}
