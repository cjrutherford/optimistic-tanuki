import { ConfigService } from '@nestjs/config';
import { KeyDatum } from '../key-data/entities/key-datum.entity';
import { UserEntity } from '../user/entities/user.entity';
import { TokenEntity } from '../tokens/entities/token.entity';
import { OAuthProviderEntity } from '../oauth-providers/entities/oauth-provider.entity';
import { AuthActionTokenEntity } from '../email-auth/entities/auth-action-token.entity';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { Initial1729455565251 } from '../../migrations/1729455565251-initial';
import { Second1730238679999 } from '../../migrations/1730238679999-second';
import { CreateOAuthProviderTable1740000000000 } from '../../migrations/1740000000000-create-oauth-provider-table';
import { NormalizeUserEmail1777410000000 } from '../../migrations/1777410000000-normalize-user-email';
import { EmailAuthentication1783915200000 } from '../../migrations/1783915200000-email-authentication';
import { FailedLoginLockout1789000000000 } from '../../migrations/1789000000000-failed-login-lockout';
import { HardenOAuthProviderIdentities1789200000000 } from '../../migrations/1789200000000-harden-oauth-provider-identities';

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  console.log(
    `Database configuration: host=${database.host}, port=${database.port}, username=${database.username}, database=${database.database}`
  );
  const entities = [
    KeyDatum,
    UserEntity,
    TokenEntity,
    OAuthProviderEntity,
    AuthActionTokenEntity,
  ];
  console.log(
    `Using database configuration: host=${database.host}, port=${database.port}, username=${database.username}, database=${database.database}`
  );
  const ormConfig: PostgresConnectionOptions = {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database || database.name,
    entities,
    migrations: [
      Initial1729455565251,
      Second1730238679999,
      CreateOAuthProviderTable1740000000000,
      NormalizeUserEmail1777410000000,
      EmailAuthentication1783915200000,
      FailedLoginLockout1789000000000,
      HardenOAuthProviderIdentities1789200000000,
    ],
    migrationsRun: process.env.OT_RUN_MIGRATIONS_ON_START === 'true',
  };
  return ormConfig;
};

export default loadDatabase;
