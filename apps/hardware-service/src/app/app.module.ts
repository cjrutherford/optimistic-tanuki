import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChassisController } from './controllers/chassis/chassis.controller';
import { ComponentsController } from './controllers/components/components.controller';
import { PricingController } from './controllers/pricing/pricing.controller';
import { OrdersController } from './controllers/orders/orders.controller';
import { ChassisService } from './services/chassis.service';
import { ComponentsService } from './services/components.service';
import { PricingService } from './services/pricing.service';
import { OrdersService } from './services/orders.service';
import loadConfig from '../config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
  ],
  controllers: [
    ChassisController,
    ComponentsController,
    PricingController,
    OrdersController,
  ],
  providers: [ChassisService, ComponentsService, PricingService, OrdersService],
})
export class AppModule {}
