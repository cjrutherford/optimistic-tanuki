import { ConfigService } from '@nestjs/config';
import {
  ComplianceAuditLogEntity,
  VaultDocumentEntity,
} from '@optimistic-tanuki/business-security';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  const ormConfig: PostgresConnectionOptions = {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database || database.name,
    entities: [ComplianceAuditLogEntity, VaultDocumentEntity],
  };
  return ormConfig;
};

export default loadDatabase;
