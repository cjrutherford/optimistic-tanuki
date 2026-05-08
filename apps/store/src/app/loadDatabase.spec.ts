import { ConfigService } from '@nestjs/config';
import loadDatabase from './loadDatabase';
import { TrainerSiteConfigEntity } from '../trainer-config/entities/trainer-site-config.entity';
import { TrainerRoutineAssignmentEntity } from '../appointments/entities/trainer-routine-assignment.entity';
import { TrainerProgressCheckInEntity } from '../appointments/entities/trainer-progress-check-in.entity';

describe('store runtime database config', () => {
  it('registers trainer config, routines, and check-in entities for the live datasource', () => {
    const configService = {
      get: jest.fn().mockReturnValue({
        host: 'db',
        port: 5432,
        username: 'postgres',
        password: 'postgres',
        database: 'ot_store',
      }),
    } as unknown as ConfigService;

    const ormConfig = loadDatabase(configService);
    const entities = (ormConfig.entities ?? []) as Array<string | Function>;
    const entityNames = entities.map((entity) =>
      typeof entity === 'function' ? entity.name : String(entity)
    );

    expect(entityNames).toContain(TrainerRoutineAssignmentEntity.name);
    expect(entityNames).toContain(TrainerProgressCheckInEntity.name);
    expect(entityNames).toContain(TrainerSiteConfigEntity.name);
  });
});
