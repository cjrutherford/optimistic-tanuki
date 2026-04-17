import { DataSource } from 'typeorm';
import { ChassisEntity } from '../hardware/entities/chassis.entity';
import { CaseOptionEntity } from '../hardware/entities/case-option.entity';
import { HardwarePartEntity } from '../hardware/entities/hardware-part.entity';
import { HardwareOrderEntity } from '../hardware/entities/hardware-order.entity';
import { SavedConfigurationEntity } from '../hardware/entities/saved-configuration.entity';

const host = process.env.POSTGRES_HOST || process.env.DB_HOST || 'db';
const port = parseInt(
  process.env.POSTGRES_PORT || process.env.DB_PORT || '5432',
  10
);
const username = process.env.POSTGRES_USER || process.env.DB_USER || 'postgres';
const password =
  process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'postgres';
const database =
  process.env.POSTGRES_DB || process.env.DB_NAME || 'ot_system_configurator';

const staticSource = new DataSource({
  type: 'postgres',
  host,
  port,
  username,
  password,
  database,
  entities: [
    ChassisEntity,
    CaseOptionEntity,
    HardwarePartEntity,
    HardwareOrderEntity,
    SavedConfigurationEntity,
  ],
  migrations: ['./src/migrations/*.ts'],
});

export default staticSource;
