import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import loadConfig from '../config';
import { AdaptersModule } from './adapters/adapters.module';
import { AgendaModule } from './agenda/agenda.module';
import { BriefingModule } from './briefing/briefing.module';
import { CivicDatabaseModule } from './civic-database.module';
import { CollateModule } from './collate/collate.module';
import { CorpusModule } from './corpus/corpus.module';
import { EditionsModule } from './editions/editions.module';
import { GatherModule } from './gather/gather.module';
import { HealthModule } from './health/health.module';
import { ParseModule } from './parse/parse.module';
import { PlatformModule } from './platform.module';
import { ProjectionModule } from './projection/projection.module';
import { QuarantineModule } from './quarantine/quarantine.module';
import { StoriesModule } from './stories/stories.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig],
    }),
    CivicDatabaseModule,
    CorpusModule,
    EditionsModule,
    HealthModule,
    PlatformModule,
    AdaptersModule,
    QuarantineModule,
    GatherModule,
    ParseModule,
    AgendaModule,
    ProjectionModule,
    CollateModule,
    StoriesModule,
    BriefingModule,
  ],
})
export class AppModule {}
