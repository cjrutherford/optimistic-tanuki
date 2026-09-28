import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { CivicAgenda } from './entities/civic-agenda.entity';
import { CivicAgendaItem } from './entities/civic-agenda-item.entity';
import { TipProject } from './entities/tip-project.entity';
import { EmergencyBroadcast } from './entities/emergency-broadcast.entity';

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  const ormConfig: PostgresConnectionOptions = {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database || database.name,
    entities: [CivicAgenda, CivicAgendaItem, TipProject, EmergencyBroadcast],
  };
  return ormConfig;
};

export default loadDatabase;
