import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import loadConfig from '../config';
import { CivicDatabaseModule } from './civic-database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    CivicDatabaseModule,
  ],
})
export class AppModule {}
