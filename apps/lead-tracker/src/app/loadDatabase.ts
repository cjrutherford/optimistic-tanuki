import { ConfigService } from '@nestjs/config';
import {
  Lead,
  LeadFlag,
  LeadOnboardingProfileRecord,
  LeadQualification,
  LeadTopic,
  LeadTopicLink,
} from '@optimistic-tanuki/models/leads-entities';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  const entities = [
    Lead,
    LeadFlag,
    LeadTopic,
    LeadTopicLink,
    LeadQualification,
    LeadOnboardingProfileRecord,
  ];
  const ormConfig: PostgresConnectionOptions = {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database || database.name,
    entities,
  };
  return ormConfig;
};

export default loadDatabase;
