import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ProductEntity } from '../products/entities/product.entity';
import { SubscriptionEntity } from '../subscriptions/entities/subscription.entity';
import { DonationEntity } from '../donations/entities/donation.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { OrderItemEntity } from '../orders/entities/order-item.entity';
import { AppointmentEntity } from '../appointments/entities/appointment.entity';
import { AvailabilityEntity } from '../appointments/entities/availability.entity';
import { AvailabilityOverrideEntity } from '../appointments/entities/availability-override.entity';
import { InvoiceEntity } from '../appointments/entities/invoice.entity';
import { ResourceEntity } from '../appointments/entities/resource.entity';
import { TrainerRoutineAssignmentEntity } from '../appointments/entities/trainer-routine-assignment.entity';
import { TrainerProgressCheckInEntity } from '../appointments/entities/trainer-progress-check-in.entity';
import { TrainerSiteConfigEntity } from '../trainer-config/entities/trainer-site-config.entity';

const config = yaml.load(
  fs.readFileSync(path.resolve('./src/assets/config.yaml'), 'utf8')
) as Record<string, any>;
const {
  database: {
    host: configHost,
    port,
    username,
    password,
    name: configName,
    database: configDatabase,
  },
} = config;
// Use environment variable for host if available, otherwise use configHost
const host = process.env.POSTGRES_HOST || configHost;
// Use environment variable for database name if available, otherwise use configDatabase or configName
const database = process.env.POSTGRES_DB || configDatabase || configName;

const entities = [
  ProductEntity,
  SubscriptionEntity,
  DonationEntity,
  OrderEntity,
  OrderItemEntity,
  AppointmentEntity,
  AvailabilityEntity,
  AvailabilityOverrideEntity,
  InvoiceEntity,
  ResourceEntity,
  TrainerRoutineAssignmentEntity,
  TrainerProgressCheckInEntity,
  TrainerSiteConfigEntity,
];

const staticSource = new DataSource({
  type: 'postgres',
  host: host,
  port: Number(port),
  username,
  password,
  database: database,
  entities,
  migrations: ['./migrations/*.ts'],
});

export default staticSource;
