import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { ClassifiedsController } from './classifieds.controller';
import { ClassifiedsService } from './classifieds.service';
import { ClassifiedAdEntity } from './entities/classified-ad.entity';
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
  controllers: [ClassifiedsController],
  providers: [
    ClassifiedsService,
    {
      provide: getRepositoryToken(ClassifiedAdEntity),
      useFactory: (dataSource: any) =>
        dataSource.getRepository(ClassifiedAdEntity),
      inject: ['CLASSIFIEDS_CONNECTION'],
    },
  ],
})
export class AppModule {}
