import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import {
  ConsoleEmailProvider,
  EmailModule,
  SmtpEmailProvider,
} from '@optimistic-tanuki/email';
import {
  Lead,
  LeadFlag,
  LeadOnboardingProfileRecord,
  LeadQualification,
  LeadTopic,
  LeadTopicLink,
} from '@optimistic-tanuki/models/leads-entities';
import { DataSource } from 'typeorm';
import { ClutchDiscoveryProvider } from './discovery/clutch-discovery.provider';
import { CrunchbaseDiscoveryProvider } from './discovery/crunchbase-discovery.provider';
import { GoogleMapsDiscoveryProvider } from './discovery/google-maps-discovery.provider';
import { HimalayasDiscoveryProvider } from './discovery/himalayas-discovery.provider';
import { IndeedDiscoveryProvider } from './discovery/indeed-discovery.provider';
import { InternalDiscoveryProvider } from './discovery/internal-discovery.provider';
import { JobicyDiscoveryProvider } from './discovery/jobicy-discovery.provider';
import { JustRemoteDiscoveryProvider } from './discovery/justremote-discovery.provider';
import { RemoteOkDiscoveryProvider } from './discovery/remoteok-discovery.provider';
import { SearchAcquisitionService } from './discovery/search-acquisition.service';
import { WeWorkRemotelyDiscoveryProvider } from './discovery/weworkremotely-discovery.provider';
import { DiscoveryService } from './discovery.service';
import { GoogleMapsLocationAutocompleteService } from './google-maps-location-autocomplete.service';
import { OnboardingAnalysisService } from './onboarding-analysis.service';
import { LlmOnboardingAnalysisService } from './llm-onboarding-analysis.service';
import { DiscoveryPipelineService } from './discovery/pipeline.service';
import { LeadQualificationService } from './lead-qualification.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import loadConfig from '../config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        timeout:
          Number(config.get('leadDiscovery.search.requestTimeoutMs')) || 5000,
        maxRedirects: 5,
      }),
    }),
    DatabaseModule.register({
      name: 'lead_tracker',
      factory: (config: ConfigService) => {
        const database = config.get('database');
        return {
          type: 'postgres',
          host: database.host,
          port: database.port,
          username: database.username,
          password: database.password,
          database: database.database || database.name,
          entities: [
            Lead,
            LeadFlag,
            LeadTopic,
            LeadTopicLink,
            LeadQualification,
            LeadOnboardingProfileRecord,
          ],
        };
      },
    }),
    EmailModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const smtpHost = config.get<string>('SMTP_HOST');
        if (smtpHost) {
          return {
            providers: [
              new SmtpEmailProvider({
                host: smtpHost,
                port: config.get<number>('SMTP_PORT') || 587,
                secure: config.get<boolean>('SMTP_SECURE') || false,
                auth: {
                  user: config.get<string>('SMTP_USER') || '',
                  pass: config.get<string>('SMTP_PASS') || '',
                },
                defaultFrom:
                  config.get<string>('SMTP_FROM') ||
                  'noreply@optimistic-tanuki.dev',
              }),
            ],
          };
        }

        return { providers: [new ConsoleEmailProvider()] };
      },
    }),
  ],
  controllers: [LeadsController],
  providers: [
    LeadsService,
    DiscoveryService,
    GoogleMapsLocationAutocompleteService,
    SearchAcquisitionService,
    LlmOnboardingAnalysisService,
    OnboardingAnalysisService,
    DiscoveryPipelineService,
    LeadQualificationService,
    InternalDiscoveryProvider,
    RemoteOkDiscoveryProvider,
    HimalayasDiscoveryProvider,
    WeWorkRemotelyDiscoveryProvider,
    JustRemoteDiscoveryProvider,
    JobicyDiscoveryProvider,
    ClutchDiscoveryProvider,
    CrunchbaseDiscoveryProvider,
    IndeedDiscoveryProvider,
    GoogleMapsDiscoveryProvider,
    {
      provide: getRepositoryToken(Lead),
      useFactory: (ds: DataSource) => ds.getRepository(Lead),
      inject: ['LEAD_TRACKER_CONNECTION'],
    },
    {
      provide: getRepositoryToken(LeadFlag),
      useFactory: (ds: DataSource) => ds.getRepository(LeadFlag),
      inject: ['LEAD_TRACKER_CONNECTION'],
    },
    {
      provide: getRepositoryToken(LeadTopic),
      useFactory: (ds: DataSource) => ds.getRepository(LeadTopic),
      inject: ['LEAD_TRACKER_CONNECTION'],
    },
    {
      provide: getRepositoryToken(LeadTopicLink),
      useFactory: (ds: DataSource) => ds.getRepository(LeadTopicLink),
      inject: ['LEAD_TRACKER_CONNECTION'],
    },
    {
      provide: getRepositoryToken(LeadQualification),
      useFactory: (ds: DataSource) => ds.getRepository(LeadQualification),
      inject: ['LEAD_TRACKER_CONNECTION'],
    },
    {
      provide: getRepositoryToken(LeadOnboardingProfileRecord),
      useFactory: (ds: DataSource) =>
        ds.getRepository(LeadOnboardingProfileRecord),
      inject: ['LEAD_TRACKER_CONNECTION'],
    },
  ],
})
export class AppModule {}
