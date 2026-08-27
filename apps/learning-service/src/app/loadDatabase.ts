import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { AttemptEntity } from '../entities/attempt.entity';
import { EvaluationEntity } from '../entities/evaluation.entity';
import { CreditLedgerEntryEntity } from '../entities/credit-ledger-entry.entity';
import { ProgramTrackEntity } from '../entities/program-track.entity';
import { LessonProgressEntity } from '../entities/lesson-progress.entity';
import { EnrolmentEntity } from '../entities/enrolment.entity';
import { OfferingOwnershipEntity } from '../entities/offering-ownership.entity';
import { InitialLearningSchema1787753971919 } from '../migrations/1787753971919-InitialLearningSchema';

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
      OfferingOwnershipEntity,
    ],
    migrations: [InitialLearningSchema1787753971919],
    migrationsRun: true,
  };
};

export default loadDatabase;
