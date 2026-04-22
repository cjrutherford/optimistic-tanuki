import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { AttemptEntity } from '../entities/attempt.entity';
import { EvaluationEntity } from '../entities/evaluation.entity';
import { CreditLedgerEntryEntity } from '../entities/credit-ledger-entry.entity';
import { ProgramTrackEntity } from '../entities/program-track.entity';
import { InitialSchema1770000000000 } from '../migrations/1770000000000-initial-schema';

const loadDatabase = (config: ConfigService): PostgresConnectionOptions => {
  const database = config.get('database');
  return {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database,
    entities: [
      ProgramTrackEntity,
      AttemptEntity,
      EvaluationEntity,
      CreditLedgerEntryEntity,
    ],
    migrations: [InitialSchema1770000000000],
    migrationsRun: true,
  };
};

export default loadDatabase;
