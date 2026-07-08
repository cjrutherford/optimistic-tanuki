import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExportJobEntity } from '../../entities/export-job.entity';
import { StartExportDto } from '@optimistic-tanuki/models';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    @InjectRepository(ExportJobEntity)
    private readonly exportRepo: Repository<ExportJobEntity>
  ) {}

  async start(
    userId: string,
    projectId: string,
    dto: StartExportDto
  ): Promise<ExportJobEntity> {
    const job = this.exportRepo.create({
      projectId,
      userId,
      format: dto.format,
      quality: dto.quality ?? 'high',
      bitrate: dto.bitrate ?? null,
      bitDepth: dto.bitDepth ?? null,
      sampleRate: dto.sampleRate ?? null,
      includeStems: dto.includeStems ?? false,
      status: 'pending',
    });

    const saved = await this.exportRepo.save(job);
    this.logger.log(`Started export job ${saved.id} for project ${projectId}`);

    this.processExport(saved).catch((err) => {
      this.logger.error(`Export ${saved.id} failed: ${err.message}`);
    });

    return saved;
  }

  private async processExport(job: ExportJobEntity): Promise<void> {
    await this.exportRepo.update(job.id, { status: 'processing' });

    try {
      // Placeholder: actual format conversion would happen here
      // via the video-transcoder-worker or similar service
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await this.exportRepo.update(job.id, {
        status: 'completed',
        resultAssetId: `export-${job.id}`,
        completedAt: new Date(),
      });
    } catch (err) {
      await this.exportRepo.update(job.id, {
        status: 'failed',
        errorMessage: err.message,
      });
    }
  }

  async getStatus(exportId: string): Promise<ExportJobEntity> {
    const job = await this.exportRepo.findOne({ where: { id: exportId } });
    if (!job) {
      throw new RpcException({ status: 404, message: 'Export job not found' });
    }
    return job;
  }

  async listByProject(projectId: string): Promise<ExportJobEntity[]> {
    return this.exportRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }
}
