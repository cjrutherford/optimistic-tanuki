import { DataSource } from 'typeorm';
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

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'ot_lead_tracker',
  entities: [
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
  ],
  migrations: ['src/migrations/*.ts', 'migrations/*.ts'],
});
