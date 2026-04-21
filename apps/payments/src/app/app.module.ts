import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import loadConfig from '../config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import loadDatabase from './loadDatabase';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Donation } from '../entities/donation.entity';
import { ClassifiedPayment } from '../entities/classified-payment.entity';
import { SellerWallet } from '../entities/seller-wallet.entity';
import { PayoutRequest } from '../entities/payout-request.entity';
import { BusinessPage } from '../entities/business-page.entity';
import { BusinessTheme } from '../entities/business-theme.entity';
import { CommunitySponsorship } from '../entities/community-sponsorship.entity';
import { Transaction } from '../entities/transaction.entity';
import { Offer } from '../entities/offer.entity';
import { LemonSqueezyProduct } from '../entities/lemon-squeezy-product.entity';
import { PaymentService } from './services/payment.service';
import { BusinessThemeService } from './services/business-theme.service';
import { OfferService } from './services/offer.service';
import { LemonSqueezyAdapter } from '@optimistic-tanuki/payments-domain';
import { PAYMENT_PROVIDER_ADAPTER } from './services/payment-provider.tokens';
import { BillingReconciliationService } from './services/billing-reconciliation.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'payments',
      factory: loadDatabase,
    }),
  ],
  controllers: [AppController],
  providers: [
    PaymentService,
    {
      provide: PAYMENT_PROVIDER_ADAPTER,
      useFactory: (configService: ConfigService) => {
        return new LemonSqueezyAdapter({
          default: configService.get('lemonSqueezy.default') || {
            apiKey: '',
            storeId: '',
          },
          stores: configService.get('lemonSqueezy.stores') || {},
        });
      },
      inject: [ConfigService],
    },
    {
      provide: getRepositoryToken(Donation),
      useFactory: (ds: DataSource) => ds.getRepository(Donation),
      inject: ['PAYMENTS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(ClassifiedPayment),
      useFactory: (ds: DataSource) => ds.getRepository(ClassifiedPayment),
      inject: ['PAYMENTS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(BusinessPage),
      useFactory: (ds: DataSource) => ds.getRepository(BusinessPage),
      inject: ['PAYMENTS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(CommunitySponsorship),
      useFactory: (ds: DataSource) => ds.getRepository(CommunitySponsorship),
      inject: ['PAYMENTS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Transaction),
      useFactory: (ds: DataSource) => ds.getRepository(Transaction),
      inject: ['PAYMENTS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(Offer),
      useFactory: (ds: DataSource) => ds.getRepository(Offer),
      inject: ['PAYMENTS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(SellerWallet),
      useFactory: (ds: DataSource) => ds.getRepository(SellerWallet),
      inject: ['PAYMENTS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(PayoutRequest),
      useFactory: (ds: DataSource) => ds.getRepository(PayoutRequest),
      inject: ['PAYMENTS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(BusinessTheme),
      useFactory: (ds: DataSource) => ds.getRepository(BusinessTheme),
      inject: ['PAYMENTS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(LemonSqueezyProduct),
      useFactory: (ds: DataSource) => ds.getRepository(LemonSqueezyProduct),
      inject: ['PAYMENTS_CONNECTION'],
    },
    BusinessThemeService,
    BillingReconciliationService,
    OfferService,
  ],
})
export class AppModule {}
