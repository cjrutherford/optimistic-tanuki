import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { AIGenerationRequestEntity } from '../../entities/ai-generation-request.entity';
import { StrategyFactory } from '../strategies/strategy-factory';
import {
  RequestGenerationDto,
  AIGenerationRequestDto,
} from '@optimistic-tanuki/models';
import { ServiceTokens, CollaborationMode } from '@optimistic-tanuki/constants';

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    @InjectRepository(AIGenerationRequestEntity)
    private readonly requestRepo: Repository<AIGenerationRequestEntity>,
    private readonly strategyFactory: StrategyFactory,
    @Inject(ServiceTokens.AI_ORCHESTRATION_SERVICE)
    private readonly aiOrchestrator: ClientProxy
  ) {}

  async requestGeneration(
    userId: string,
    dto: RequestGenerationDto
  ): Promise<AIGenerationRequestDto> {
    const mode = dto.collaborationMode || CollaborationMode.FULL_AUTO;
    const strategy = this.strategyFactory.getStrategy(mode);
    const agents = strategy.determineAgents();

    const entity = this.requestRepo.create({
      projectId: dto.projectId,
      userId,
      collaborationMode: mode,
      agentType: 'compose',
      prompt: dto.prompt || '',
      parameters: dto.parameters || {},
      voiceMemoAssetId: dto.voiceMemoAssetId || null,
      referenceTrackAssetId: dto.referenceTrackAssetId || null,
      status: 'pending',
    });

    const saved = await this.requestRepo.save(entity);

    this.dispatchToAgent(saved, strategy).catch((err) => {
      this.logger.error(`Generation ${saved.id} failed: ${err.message}`);
    });

    return this.toDto(saved);
  }

  private async dispatchToAgent(
    request: AIGenerationRequestEntity,
    strategy: any
  ): Promise<void> {
    await this.requestRepo.update(request.id, { status: 'processing' });

    const prompt = strategy.buildPrompt(request);
    const params = strategy.buildParameters(request);
    const agents = strategy.determineAgents();

    try {
      for (const agent of agents) {
        const result = await firstValueFrom(
          this.aiOrchestrator.send(
            { cmd: `EXECUTE_${agent.toUpperCase()}_AGENT` },
            {
              requestId: request.id,
              projectId: request.projectId,
              prompt,
              parameters: params,
              voiceMemoAssetId: request.voiceMemoAssetId,
              referenceTrackAssetId: request.referenceTrackAssetId,
            }
          )
        );

        this.logger.log(
          `Agent ${agent} completed for request ${request.id}: ${JSON.stringify(
            result
          )}`
        );
      }

      await this.requestRepo.update(request.id, {
        status: 'completed',
        completedAt: new Date(),
      });
    } catch (err) {
      this.logger.error(`Agent chain failed for ${request.id}: ${err.message}`);
      await this.requestRepo.update(request.id, {
        status: 'failed',
        errorMessage: err.message,
      });
    }
  }

  async getStatus(requestId: string): Promise<AIGenerationRequestDto> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
    });
    if (!request) {
      throw new RpcException({
        status: 404,
        message: 'Generation request not found',
      });
    }
    return this.toDto(request);
  }

  async listByProject(projectId: string): Promise<AIGenerationRequestDto[]> {
    const requests = await this.requestRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
    return requests.map((r) => this.toDto(r));
  }

  async cancel(requestId: string): Promise<void> {
    await this.requestRepo.update(requestId, {
      status: 'failed',
      errorMessage: 'Cancelled by user',
    });
  }

  private toDto(entity: AIGenerationRequestEntity): AIGenerationRequestDto {
    return {
      id: entity.id,
      projectId: entity.projectId,
      collaborationMode: entity.collaborationMode as any,
      agentType: entity.agentType as any,
      prompt: entity.prompt,
      status: entity.status as any,
      resultAssetId: entity.resultAssetId,
      errorMessage: entity.errorMessage,
      createdAt: entity.createdAt.toISOString(),
      completedAt: entity.completedAt?.toISOString() ?? null,
    };
  }
}
