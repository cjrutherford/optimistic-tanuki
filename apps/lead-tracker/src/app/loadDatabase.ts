import { ConfigService } from '@nestjs/config';
import {
  Lead,
  LeadFlag,
  LeadApplicationRecord,
  LeadOnboardingProfileRecord,
  LeadQualification,
  LeadTopic,
  LeadTopicLink,
} from '@optimistic-tanuki/models/leads-entities';
import { FlowBooking } from './entities/flow-booking.entity';
import { FlowBookingUpdate } from './entities/flow-booking-update.entity';
import { FlowEstimate } from './entities/flow-estimate.entity';
import { LeadNotificationOutbox } from './entities/lead-notification-outbox.entity';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { Initial1774807107180 } from '../../migrations/1774807107180-initial';
import { AddLeadTopicLinks1774812000000 } from '../../migrations/1774812000000-add-lead-topic-links';
import { AddTopicSources1774812600000 } from '../../migrations/1774812600000-add-topic-sources';
import { Initial1774822235070 } from '../../migrations/1774822235070-initial';
import { AlignDiscoverySources1774825000000 } from '../../migrations/1774825000000-align-discovery-sources';
import { AddTopicIntentAndExcludedTerms1774828800000 } from '../../migrations/1774828800000-add-topic-intent-and-excluded-terms';
import { AddOnboardingTopicMetadata1774915200000 } from '../../migrations/1774915200000-add-onboarding-topic-metadata';
import { AddLeadQualificationPipeline1774918800000 } from '../../migrations/1774918800000-add-lead-qualification-pipeline';
import { AddLeadContactMetadata1775001600000 } from '../../migrations/1775001600000-add-lead-contact-metadata';
import { AddGoogleMapsLocationRadius1775005200000 } from '../../migrations/1775005200000-add-google-maps-location-radius';
import { ScopeLeadsByProfile1775088000000 } from '../../migrations/1775088000000-scope-leads-by-profile';
import { AddPublicContactFields1780444800000 } from '../../migrations/1780444800000-add-public-contact-fields';
import { AddOnboardingDiscTranscript1787170007574 } from '../../migrations/1787170007574-add-onboarding-disc-transcript';
import { AddFundingNewsLeadSource1787184176466 } from '../../migrations/1787184176466-add-funding-news-lead-source';
import { MigrateTopicsOffRetiredSources1787184267302 } from '../../migrations/1787184267302-migrate-topics-off-retired-sources';
import { AlignLeadQualificationConstraints1787220432006 } from '../../migrations/1787220432006-align-lead-qualification-constraints';
import { AddNewDiscoverySources1787221623538 } from '../../migrations/1787221623538-add-new-discovery-sources';
import { AddOverpassLeadSource1787225879089 } from '../../migrations/1787225879089-add-overpass-lead-source';
import { AddAspirationalAtsSources1787226492478 } from '../../migrations/1787226492478-add-aspirational-ats-sources';
import { AddLeadApplications1787227913318 } from '../../migrations/1787227913318-add-lead-applications';
import { UniqueApplicationVersion1787258467295 } from '../../migrations/1787258467295-unique-application-version';
import { AddFlowOperations1790304595692 } from '../../migrations/1790304595692-add-flow-operations';
import { AddHaiLeadSlaAndNotificationOutbox1790521920248 } from '../../migrations/1790521920248-add-hai-lead-sla-and-notification-outbox';
import { AddHaiHardwareProposalCommit1790555122555 } from '../../migrations/1790555122555-add-hai-hardware-proposal-commit';

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  const entities = [
    Lead,
    LeadFlag,
    LeadTopic,
    LeadTopicLink,
    LeadQualification,
    LeadApplicationRecord,
    LeadOnboardingProfileRecord,
    FlowEstimate,
    FlowBooking,
    FlowBookingUpdate,
    LeadNotificationOutbox,
  ];
  const ormConfig: PostgresConnectionOptions = {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database || database.name,
    entities,
    migrations: [
      Initial1774807107180,
      AddLeadTopicLinks1774812000000,
      AddTopicSources1774812600000,
      Initial1774822235070,
      AlignDiscoverySources1774825000000,
      AddTopicIntentAndExcludedTerms1774828800000,
      AddOnboardingTopicMetadata1774915200000,
      AddLeadQualificationPipeline1774918800000,
      AddLeadContactMetadata1775001600000,
      AddGoogleMapsLocationRadius1775005200000,
      ScopeLeadsByProfile1775088000000,
      AddPublicContactFields1780444800000,
      AddOnboardingDiscTranscript1787170007574,
      AddFundingNewsLeadSource1787184176466,
      MigrateTopicsOffRetiredSources1787184267302,
      AlignLeadQualificationConstraints1787220432006,
      AddNewDiscoverySources1787221623538,
      AddOverpassLeadSource1787225879089,
      AddAspirationalAtsSources1787226492478,
      AddLeadApplications1787227913318,
      UniqueApplicationVersion1787258467295,
      AddFlowOperations1790304595692,
      AddHaiLeadSlaAndNotificationOutbox1790521920248,
      AddHaiHardwareProposalCommit1790555122555,
    ],
    migrationsRun: process.env.OT_RUN_MIGRATIONS_ON_START === 'true',
  };
  return ormConfig;
};

export default loadDatabase;
