import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { ClassifiedsController } from './classifieds.controller';
import { ClassifiedsService } from './classifieds.service';
import { LocalCommunityController } from './local-community.controller';
import { LocalCommunityService } from './local-community.service';
import { ClassifiedAdEntity } from './entities/classified-ad.entity';
import { LocalCommunityEntity } from './entities/local-community.entity';
import { LocalCommunityMembershipEntity } from './entities/local-community-membership.entity';
import loadDatabase from './loadDatabase';
import loadConfig from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    DatabaseModule.register({
      name: 'classifieds',
      factory: loadDatabase,
    }),
    LoggerModule,
  ],
  controllers: [ClassifiedsController, LocalCommunityController],
  providers: [
    ClassifiedsService,
    LocalCommunityService,
    {
      provide: getRepositoryToken(ClassifiedAdEntity),
      useFactory: (dataSource: any) =>
        dataSource.getRepository(ClassifiedAdEntity),
      inject: ['CLASSIFIEDS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(LocalCommunityEntity),
      useFactory: (dataSource: any) =>
        dataSource.getRepository(LocalCommunityEntity),
      inject: ['CLASSIFIEDS_CONNECTION'],
    },
    {
      provide: getRepositoryToken(LocalCommunityMembershipEntity),
      useFactory: (dataSource: any) =>
        dataSource.getRepository(LocalCommunityMembershipEntity),
      inject: ['CLASSIFIEDS_CONNECTION'],
    },
  ],
})
export class AppModule {}
