import { DataSource } from 'typeorm';
import { AttemptEntity } from '../entities/attempt.entity';
import { EvaluationEntity } from '../entities/evaluation.entity';
import { CreditLedgerEntryEntity } from '../entities/credit-ledger-entry.entity';
import { ProgramTrackEntity } from '../entities/program-track.entity';
import { LessonProgressEntity } from '../entities/lesson-progress.entity';
import { EnrolmentEntity } from '../entities/enrolment.entity';
import { OfferingOwnershipEntity } from '../entities/offering-ownership.entity';
import { InitialLearningSchema1787753971919 } from '../migrations/1787753971919-InitialLearningSchema';

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
    LessonProgressEntity,
    EnrolmentEntity,
    OfferingOwnershipEntity,
  ],
  // Generated with `nx run learning-service:typeorm:migration:generate`.
  // Hand-written migrations drift from the entities, and this workspace has
  // been bitten by that: a schema the entities never described, and classes
  // renumbered after they had already run.
  migrations: [InitialLearningSchema1787753971919],
  synchronize: false,
  logging: true,
};

export default new DataSource(config);
