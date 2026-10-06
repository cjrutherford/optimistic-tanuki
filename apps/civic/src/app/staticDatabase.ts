import { DataSource } from 'typeorm';
import { CivicAgenda } from './entities/civic-agenda.entity';
import { CivicAgendaItem } from './entities/civic-agenda-item.entity';
import { TipProject } from './entities/tip-project.entity';
import { EmergencyBroadcast } from './entities/emergency-broadcast.entity';
import { CivicTenant } from './entities/civic-tenant.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'ot_civic',
  entities: [
    CivicAgenda,
    CivicAgendaItem,
    TipProject,
    EmergencyBroadcast,
    CivicTenant,
  ],
  migrations: ['migrations/*.ts'],
});
