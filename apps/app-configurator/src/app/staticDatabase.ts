import { DataSource } from 'typeorm';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import { AppInstanceEntity } from '../configurations/entities/app-instance.entity';
import { AppMembershipEntity } from '../configurations/entities/app-membership.entity';

const host = process.env.POSTGRES_HOST || 'db';
const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
const username = process.env.POSTGRES_USER || 'postgres';
const password = process.env.POSTGRES_PASSWORD || 'postgres';
const database = process.env.POSTGRES_DB || 'ot_app_configurator';

const entities = [
  AppConfigurationEntity,
  AppInstanceEntity,
  AppMembershipEntity,
];

console.log(
  `Using database configuration: host=${host}, port=${port}, username=${username}, database=${database}`
);

const staticSource = new DataSource({
  type: 'postgres',
  host,
  port,
  username,
  password,
  database,
  entities,
  migrations: ['./migrations/*.ts'],
});

export default staticSource;
