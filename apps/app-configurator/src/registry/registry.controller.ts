import { Controller, HttpException, Logger } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { AppConfigCommands } from '@optimistic-tanuki/constants';
import type {
  RegistryAuditRecord,
  RegistryDriftReport,
  RegistryReleaseBundle,
  RegistrySourceSnapshot,
  RegistryYamlExport,
} from '@optimistic-tanuki/app-registry-backend';
import { RegistryService } from './registry.service';

type SaveDraftPayload = Parameters<RegistryService['saveDraft']>[0];
type PublishPayload = Parameters<RegistryService['publish']>[0];
type RollbackPayload = Parameters<RegistryService['rollback']>[0];

@Controller('registry')
export class RegistryController {
  private readonly logger = new Logger(RegistryController.name);

  constructor(private readonly registry: RegistryService) {}

  @MessagePattern({ cmd: AppConfigCommands.RegistrySeed })
  seed(@Payload() data: { source: RegistrySourceSnapshot }) {
    return this.run(() => this.registry.seed(data));
  }

  @MessagePattern({ cmd: AppConfigCommands.RegistryGet })
  get(): Promise<RegistryReleaseBundle | null> {
    return this.run(() => this.registry.get());
  }

  @MessagePattern({ cmd: AppConfigCommands.RegistrySaveDraft })
  saveDraft(@Payload() data: SaveDraftPayload) {
    return this.run(() => this.registry.saveDraft(data));
  }

  @MessagePattern({ cmd: AppConfigCommands.RegistryPublish })
  publish(@Payload() data: PublishPayload) {
    return this.run(() => this.registry.publish(data));
  }

  @MessagePattern({ cmd: AppConfigCommands.RegistryRollback })
  rollback(@Payload() data: RollbackPayload) {
    return this.run(() => this.registry.rollback(data));
  }

  @MessagePattern({ cmd: AppConfigCommands.RegistryAuditList })
  auditList(
    @Payload() data?: { limit?: number }
  ): Promise<RegistryAuditRecord[]> {
    return this.run(() => this.registry.auditList(data ?? {}));
  }

  @MessagePattern({ cmd: AppConfigCommands.RegistryDrift })
  drift(
    @Payload() data: { source: RegistrySourceSnapshot }
  ): Promise<RegistryDriftReport> {
    return this.run(() => this.registry.drift(data));
  }

  @MessagePattern({ cmd: AppConfigCommands.RegistryExportYaml })
  exportYaml(
    @Payload() data: { source: RegistrySourceSnapshot }
  ): Promise<RegistryYamlExport> {
    return this.run(() => this.registry.exportYaml(data));
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpException) {
        throw new RpcException(error.getResponse());
      }
      this.logger.error(
        `Registry command failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }
}
