import fs from 'fs';
import path from 'path';
import { DataSource } from 'typeorm';
import { TrainerSiteConfigEntity } from '../trainer-config/entities/trainer-site-config.entity';
import { TrainerRoutineAssignmentEntity } from '../appointments/entities/trainer-routine-assignment.entity';
import { TrainerProgressCheckInEntity } from '../appointments/entities/trainer-progress-check-in.entity';

describe('store static datasource', () => {
  const originalCwd = process.cwd();
  const appRoot = path.resolve(__dirname, '../..');
  let staticSource: DataSource;
  let metadataSource: DataSource;

  beforeAll(async () => {
    jest.resetModules();
    process.chdir(appRoot);

    ({ default: staticSource } = await import('./staticDatabase'));
    metadataSource = new DataSource({
      ...staticSource.options,
      migrations: [],
    });
    await (
      metadataSource as unknown as { buildMetadatas(): Promise<void> }
    ).buildMetadatas();
  });

  afterAll(() => {
    process.chdir(originalCwd);
  });

  it('registers trainer site config metadata', () => {
    const entities = (staticSource.options.entities ?? []) as Function[];
    const entityNames = entities.map((entity) => entity.name);
    const trainerMetadata = metadataSource.entityMetadatas.find(
      (metadata) => metadata.name === TrainerSiteConfigEntity.name
    );

    expect(entityNames).toContain(TrainerSiteConfigEntity.name);
    expect(trainerMetadata?.tableName).toBe('trainer_site_configs');
  });

  it('registers trainer routines and check-in metadata', () => {
    const entityNames = (
      (staticSource.options.entities ?? []) as Function[]
    ).map((entity) => entity.name);
    const routineMetadata = metadataSource.entityMetadatas.find(
      (metadata) => metadata.name === TrainerRoutineAssignmentEntity.name
    );
    const checkInMetadata = metadataSource.entityMetadatas.find(
      (metadata) => metadata.name === TrainerProgressCheckInEntity.name
    );

    expect(entityNames).toContain(TrainerRoutineAssignmentEntity.name);
    expect(entityNames).toContain(TrainerProgressCheckInEntity.name);
    expect(routineMetadata?.tableName).toBe('trainer_routine_assignments');
    expect(checkInMetadata?.tableName).toBe('trainer_progress_check_ins');
  });

  it('includes the trainer site config migration file', () => {
    const migrationsDir = path.resolve(__dirname, '../../migrations');
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.ts'));

    expect(migrationFiles).toContain(
      '1770000001000-add-trainer-site-configs.ts'
    );
    expect(migrationFiles).toContain(
      '1770000002000-add-trainer-routines-and-checkins.ts'
    );
    expect(migrationFiles).toContain(
      '1770000003000-add-trainer-site-lead-context.ts'
    );
    expect(migrationFiles).toContain(
      '1770000005000-add-trainer-site-config-sections.ts'
    );
    expect(migrationFiles).toContain(
      '1770000007000-add-trainer-site-metadata.ts'
    );
    expect(migrationFiles).toContain(
      '1770000008000-add-trainer-site-business-type.ts'
    );
  });
});
