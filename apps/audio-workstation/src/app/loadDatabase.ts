import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { AudioProjectEntity } from '../entities/audio-project.entity';
import { TrackEntity } from '../entities/track.entity';
import { ArrangementSectionEntity } from '../entities/arrangement-section.entity';
import { MixSnapshotEntity } from '../entities/mix-snapshot.entity';
import { AIGenerationRequestEntity } from '../entities/ai-generation-request.entity';
import { ExportJobEntity } from '../entities/export-job.entity';

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  const entities = [
    AudioProjectEntity,
    TrackEntity,
    ArrangementSectionEntity,
    MixSnapshotEntity,
    AIGenerationRequestEntity,
    ExportJobEntity,
  ];
  const ormConfig: PostgresConnectionOptions = {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database,
    entities,
  };
  return ormConfig;
};

export default loadDatabase;
