import { DataSource } from 'typeorm';
import { AttemptEntity } from '../entities/attempt.entity';
import { EvaluationEntity } from '../entities/evaluation.entity';
import { CreditLedgerEntryEntity } from '../entities/credit-ledger-entry.entity';
import { ProgramTrackEntity } from '../entities/program-track.entity';
import { LessonProgressEntity } from '../entities/lesson-progress.entity';
import { EnrolmentEntity } from '../entities/enrolment.entity';
import { InitialSchema1770000000000 } from '../migrations/1770000000000-initial-schema';
import { LessonProgress1770000000001 } from '../migrations/1770000000001-lesson-progress';
import { EvaluationRecordedBy1770000000002 } from '../migrations/1770000000002-evaluation-recorded-by';
import { Enrolment1770000000003 } from '../migrations/1770000000003-enrolment';
import { LessonProgressProfile1770000000004 } from '../migrations/1770000000004-lesson-progress-profile';

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
  ],
  migrations: [
    InitialSchema1770000000000,
    LessonProgress1770000000001,
    EvaluationRecordedBy1770000000002,
    Enrolment1770000000003,
    LessonProgressProfile1770000000004,
  ],
  synchronize: false,
  logging: true,
};

export default new DataSource(config);
