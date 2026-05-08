import { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
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

const loadDatabase = (config: ConfigService) => {
  const database = config.get('database');
  console.log(`Database configuration: ${JSON.stringify(database)}`);
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
  };
  return ormConfig;
};

export default loadDatabase;
