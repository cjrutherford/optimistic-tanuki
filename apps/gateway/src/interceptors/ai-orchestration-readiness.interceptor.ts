import {
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { CommonCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom } from 'rxjs';
import { Observable } from 'rxjs';

type OrchestratorHealth = {
  status?: string;
  dependencies?: Record<string, 'enabled' | 'disabled'>;
};

/**
 * O27b readiness gate (R5): ai-orchestration routes fail closed when the
 * orchestrator itself reports anything but healthy (i.e. a required
 * downstream is disabled — see O22 `REQUIRED_ORCHESTRATOR_SERVICE_IDS`).
 *
 * Implemented as an interceptor (not a guard) so the global
 * RequestTimeoutInterceptor — registered outermost — bounds the health
 * probe itself: a hung orchestrator surfaces as a clean disabled error,
 * never a hang. Guards run before interceptors and could not reuse that
 * bound.
 */
@Injectable()
export class AiOrchestrationReadinessInterceptor implements NestInterceptor {
  private readonly logger = new Logger(
    AiOrchestrationReadinessInterceptor.name
  );

  constructor(
    @Inject(ServiceTokens.AI_ORCHESTRATION_SERVICE)
    private readonly orchestratorClient: ClientProxy
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<unknown>> {
    let health: OrchestratorHealth;
    try {
      health = await firstValueFrom(
        this.orchestratorClient.send({ cmd: CommonCommands.HealthCheck }, {})
      );
    } catch (error) {
      this.logger.warn(
        `AI orchestrator health probe failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw new ServiceUnavailableException(
        'AI orchestration is currently unavailable'
      );
    }

    if (!health || health.status !== 'healthy') {
      const disabled = Object.entries(health?.dependencies ?? {})
        .filter(([, state]) => state === 'disabled')
        .map(([serviceId]) => serviceId);
      this.logger.warn(
        `AI orchestrator degraded (disabled: ${
          disabled.join(', ') || 'unknown'
        }) — refusing ai-orchestration call`
      );
      throw new ServiceUnavailableException(
        'AI orchestration is currently unavailable'
      );
    }

    return next.handle();
  }
}
