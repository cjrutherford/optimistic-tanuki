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
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

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
