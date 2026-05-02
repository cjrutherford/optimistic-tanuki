import { DataSource } from 'typeorm';
import fs from 'fs';
import path from 'path';
import * as yaml from 'js-yaml';
import { KeyDatum } from '../key-data/entities/key-datum.entity';
import { TokenEntity } from '../tokens/entities/token.entity';
import { UserEntity } from '../user/entities/user.entity';
import { OAuthProviderEntity } from '../oauth-providers/entities/oauth-provider.entity';

const resolveConfigPath = () => {
  const candidates = [
    path.resolve('./src/assets/config.yaml'),
    path.resolve('./src/assets/config.yaml.sample'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Authentication staticDatabase config not found. Expected one of: ${candidates.join(', ')}`
  );
};

const config = yaml.load(
  fs.readFileSync(resolveConfigPath(), 'utf8')
) as Record<string, any>;
const {
  database: {
    host: configHost, // Renamed to avoid conflict
    port,
    username,
    password,
    name: configName, // Renamed to avoid conflict
    database: configDatabase, // Renamed to avoid conflict
  },
} = config;

// Use environment variable for host if available, otherwise use configHost
const host = process.env.POSTGRES_HOST || configHost;
// Use environment variable for database name if available, otherwise use configDatabase or configName
const database = process.env.POSTGRES_DB || configDatabase || configName;

const entities = [KeyDatum, UserEntity, TokenEntity, OAuthProviderEntity];

console.log(
  `Using database configuration: host=${host}, port=${port}, username=${username}, database=${database}`
);
const staticSource = new DataSource({
  type: 'postgres',
  host: host, // Use the potentially overridden host
  port: Number(port),
  username,
  password,
  database: database, // Use the potentially overridden database name
  entities,
  migrations: ['./migrations/*.ts'],
});
export default staticSource;
