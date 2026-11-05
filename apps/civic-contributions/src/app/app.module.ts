import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { VirusScanService } from '@optimistic-tanuki/storage';
import loadConfig, { COMMUNITY_CONFIG, type CommunityConfig } from '../config';
import { CommunityController } from './community.controller';
import { ContributionsDatabaseModule } from './contributions-database.module';
import { CopyrightService } from './copyright.service';
import { CIVIC_BRIEFING_CLIENT, CorpusService } from './corpus.service';
import { CorroborationService } from './corroboration.service';
import { DensityService } from './density.service';
import { IntakeService } from './intake.service';
import { LOCALITIES, LocalitiesService } from './localities';
import { OfficialsService } from './officials.service';
import { OutcomeService } from './outcome.service';
import { PromotionService } from './promotion.service';
import { PROMPT_PROXY_CLIENT, REVIEW_MODEL, reviewModel } from './review-model';
import { SurfaceService } from './surface.service';
import { ArtifactStore } from './uploads/artifact-store';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    ContributionsDatabaseModule,
  ],
  controllers: [CommunityController],
  providers: [
    {
      provide: COMMUNITY_CONFIG,
      useFactory: (): CommunityConfig => loadConfig(),
    },
    {
      provide: LocalitiesService,
      useFactory: (
        briefing: ConstructorParameters<typeof LocalitiesService>[0]
      ) => new LocalitiesService(briefing, new Logger('Localities')),
      inject: [CIVIC_BRIEFING_CLIENT],
    },
    { provide: LOCALITIES, useExisting: LocalitiesService },
    {
      provide: CIVIC_BRIEFING_CLIENT,
      useFactory: (config: CommunityConfig) =>
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: config.civicBriefing,
        }),
      inject: [COMMUNITY_CONFIG],
    },
    {
      provide: PROMPT_PROXY_CLIENT,
      useFactory: (config: CommunityConfig) =>
        config.llmTransport === 'prompt-proxy'
          ? ClientProxyFactory.create({
              transport: Transport.TCP,
              options: config.promptProxy,
            })
          : null,
      inject: [COMMUNITY_CONFIG],
    },
    {
      provide: REVIEW_MODEL,
      useFactory: (
        config: CommunityConfig,
        promptProxy: Parameters<typeof reviewModel>[1] | null
      ) => reviewModel(config, promptProxy ?? undefined),
      inject: [COMMUNITY_CONFIG, PROMPT_PROXY_CLIENT],
    },
    VirusScanService,
    CorpusService,
    CorroborationService,
    SurfaceService,
    ArtifactStore,
    IntakeService,
    OfficialsService,
    CopyrightService,
    OutcomeService,
    PromotionService,
    DensityService,
  ],
})
export class AppModule {}
