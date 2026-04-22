import { DataSource } from 'typeorm';
import { AttemptEntity } from '../entities/attempt.entity';
import { EvaluationEntity } from '../entities/evaluation.entity';
import { CreditLedgerEntryEntity } from '../entities/credit-ledger-entry.entity';
import { ProgramTrackEntity } from '../entities/program-track.entity';
import { InitialSchema1770000000000 } from '../migrations/1770000000000-initial-schema';

const config = {
  type: 'postgres' as const,
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'ot_learning_service',
  entities: [
    ProgramTrackEntity,
    AttemptEntity,
    EvaluationEntity,
    CreditLedgerEntryEntity,
  ],
  migrations: [InitialSchema1770000000000],
  synchronize: false,
  logging: true,
};

export default new DataSource(config);
