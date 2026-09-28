import { DataSourceOptions } from 'typeorm';
import loadConfig from '../config';
import { ChassisEntity } from '../hardware/entities/chassis.entity';
import { CaseOptionEntity } from '../hardware/entities/case-option.entity';
import { HardwarePartEntity } from '../hardware/entities/hardware-part.entity';
import { HardwareOrderEntity } from '../hardware/entities/hardware-order.entity';
import { SavedConfigurationEntity } from '../hardware/entities/saved-configuration.entity';
import { SupplierOfferEntity } from '../hardware/entities/supplier-offer.entity';
import { CommercialQuoteEntity } from '../hardware/entities/commercial-quote.entity';
import { InitSystemConfigurator1764400000000 } from '../migrations/1764400000000-init-system-configurator';
import { AddCommercialPersistence1790554190543 } from '../migrations/1790554190543-AddCommercialPersistence';
import { AddSupplierOfferSourceChannel1790594261336 } from '../migrations/1790594261336-AddSupplierOfferSourceChannel';

export default (): DataSourceOptions => {
  const appConfig = loadConfig();

  return {
    type: 'postgres',
    host: appConfig.database.host,
    port: appConfig.database.port,
    username: appConfig.database.username,
    password: appConfig.database.password,
    database: appConfig.database.database,
    entities: [
      ChassisEntity,
      CaseOptionEntity,
      HardwarePartEntity,
      HardwareOrderEntity,
      SavedConfigurationEntity,
      SupplierOfferEntity,
      CommercialQuoteEntity,
    ],
    synchronize: false,
    migrations: [
      InitSystemConfigurator1764400000000,
      AddCommercialPersistence1790554190543,
      AddSupplierOfferSourceChannel1790594261336,
    ],
    migrationsRun:
      process.env.SYSTEM_CONFIGURATOR_RUN_MIGRATIONS_ON_START === 'true',
    logging: process.env.NODE_ENV === 'development',
  };
};
