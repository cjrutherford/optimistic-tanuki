import { DataSource } from 'typeorm';
import { AudioProjectEntity } from '../entities/audio-project.entity';
import { TrackEntity } from '../entities/track.entity';
import { ArrangementSectionEntity } from '../entities/arrangement-section.entity';
import { MixSnapshotEntity } from '../entities/mix-snapshot.entity';
import { AIGenerationRequestEntity } from '../entities/ai-generation-request.entity';
import { ExportJobEntity } from '../entities/export-job.entity';
import * as dotenv from 'dotenv';
dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database:
    process.env.POSTGRES_DB || process.env.DATABASE_NAME || 'audio_workstation',
  entities: [
    AudioProjectEntity,
    TrackEntity,
    ArrangementSectionEntity,
    MixSnapshotEntity,
    AIGenerationRequestEntity,
    ExportJobEntity,
  ],
  migrations: ['migrations/*.ts'],
});
