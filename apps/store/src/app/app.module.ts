import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { DataSource } from 'typeorm';
import loadConfig from '../config';
import { ProductEntity } from '../products/entities/product.entity';
import { SubscriptionEntity } from '../subscriptions/entities/subscription.entity';
import { DonationEntity } from '../donations/entities/donation.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { OrderItemEntity } from '../orders/entities/order-item.entity';
import { ProductsController } from '../products/products.controller';
import { ProductsService } from '../products/products.service';
import { SubscriptionsController } from '../subscriptions/subscriptions.controller';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { DonationsController } from '../donations/donations.controller';
import { DonationsService } from '../donations/donations.service';
import { OrdersController } from '../orders/orders.controller';
import { OrdersService } from '../orders/orders.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import loadDatabase from './loadDatabase';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'store',
      factory: loadDatabase,
    }),
    LoggerModule,
  ],
  controllers: [
    AppController,
    ProductsController,
    SubscriptionsController,
    DonationsController,
    OrdersController,
  ],
  providers: [
    AppService,
    ProductsService,
    SubscriptionsService,
    DonationsService,
    OrdersService,
    {
      provide: getRepositoryToken(ProductEntity),
      useFactory: (ds: DataSource) => ds.getRepository(ProductEntity),
      inject: ['STORE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(SubscriptionEntity),
      useFactory: (ds: DataSource) => ds.getRepository(SubscriptionEntity),
      inject: ['STORE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(DonationEntity),
      useFactory: (ds: DataSource) => ds.getRepository(DonationEntity),
      inject: ['STORE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(OrderEntity),
      useFactory: (ds: DataSource) => ds.getRepository(OrderEntity),
      inject: ['STORE_CONNECTION'],
    },
    {
      provide: getRepositoryToken(OrderItemEntity),
      useFactory: (ds: DataSource) => ds.getRepository(OrderItemEntity),
      inject: ['STORE_CONNECTION'],
    },
  ],
})
export class AppModule {}
