import { DataSourceOptions } from 'typeorm';
import loadConfig from '../config';
import { ChassisEntity } from '../hardware/entities/chassis.entity';
import { CaseOptionEntity } from '../hardware/entities/case-option.entity';
import { HardwarePartEntity } from '../hardware/entities/hardware-part.entity';
import { HardwareOrderEntity } from '../hardware/entities/hardware-order.entity';
import { SavedConfigurationEntity } from '../hardware/entities/saved-configuration.entity';

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
    ],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
  };
};
