import { DataSource } from 'typeorm';
import {
  Lead,
  LeadFlag,
  LeadOnboardingProfileRecord,
  LeadQualification,
  LeadTopic,
  LeadTopicLink,
} from '@optimistic-tanuki/models/leads-entities';

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
    LeadOnboardingProfileRecord,
  ],
  migrations: ['src/migrations/*.ts', 'migrations/*.ts'],
});
