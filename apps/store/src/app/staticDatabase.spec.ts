import fs from 'fs';
import path from 'path';
import { TrainerSiteConfigEntity } from '../trainer-config/entities/trainer-site-config.entity';
import { TrainerRoutineAssignmentEntity } from '../appointments/entities/trainer-routine-assignment.entity';
import { TrainerProgressCheckInEntity } from '../appointments/entities/trainer-progress-check-in.entity';

describe('store static datasource', () => {
  const originalCwd = process.cwd();
  const appRoot = path.resolve(__dirname, '../..');

  beforeEach(() => {
    jest.resetModules();
    process.chdir(appRoot);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it('registers trainer site config metadata', async () => {
    const { default: staticSource } = await import('./staticDatabase');

    await (
      staticSource as unknown as { buildMetadatas(): Promise<void> }
    ).buildMetadatas();

    const entities = (staticSource.options.entities ?? []) as Function[];
    const entityNames = entities.map((entity) => entity.name);
    const trainerMetadata = staticSource.entityMetadatas.find(
      (metadata) => metadata.name === TrainerSiteConfigEntity.name
    );

    expect(entityNames).toContain(TrainerSiteConfigEntity.name);
    expect(trainerMetadata?.tableName).toBe('trainer_site_configs');
  });

  it('registers trainer routines and check-in metadata', async () => {
    const { default: staticSource } = await import('./staticDatabase');

    await (
      staticSource as unknown as { buildMetadatas(): Promise<void> }
    ).buildMetadatas();

    const entityNames = ((staticSource.options.entities ?? []) as Function[]).map(
      (entity) => entity.name
    );
    const routineMetadata = staticSource.entityMetadatas.find(
      (metadata) => metadata.name === TrainerRoutineAssignmentEntity.name
    );
    const checkInMetadata = staticSource.entityMetadatas.find(
      (metadata) => metadata.name === TrainerProgressCheckInEntity.name
    );

    expect(entityNames).toContain(TrainerRoutineAssignmentEntity.name);
    expect(entityNames).toContain(TrainerProgressCheckInEntity.name);
    expect(routineMetadata?.tableName).toBe('trainer_routine_assignments');
    expect(checkInMetadata?.tableName).toBe('trainer_progress_check_ins');
  });

  it('includes the trainer site config migration file', async () => {
    await import('./staticDatabase');

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
  });
});
