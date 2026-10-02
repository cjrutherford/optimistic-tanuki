import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import loadConfig from '../config';
import { ContributionsDatabaseModule } from './contributions-database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    ContributionsDatabaseModule,
  ],
})
export class AppModule {}
