import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
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
import { ProgressRequiresEnrolment1770000000005 } from '../migrations/1770000000005-progress-requires-enrolment';

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
      LessonProgressEntity,
      EnrolmentEntity,
    ],
    migrations: [
      InitialSchema1770000000000,
      LessonProgress1770000000001,
      EvaluationRecordedBy1770000000002,
      Enrolment1770000000003,
      LessonProgressProfile1770000000004,
      ProgressRequiresEnrolment1770000000005,
    ],
    migrationsRun: true,
  };
};

export default loadDatabase;
