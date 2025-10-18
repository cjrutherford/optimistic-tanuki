import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { loadConfig } from './config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { ProjectTelosController } from './project-telos/project-telos.controller';
import { ProfileTelosController } from './profile-telos/profile-telos.controller';
import { PersonaTelosService } from './persona-telos/persona-telos.service';
import { ProjectTelosService } from './project-telos/project-telos.service';
import { ProfileTelosService } from './profile-telos/profile-telos.service';
import loadDatabase from './database';
import { PersonaTelosController } from './persona-telos/persona-telos.controller';
import { LoggerModule } from '@optimistic-tanuki/logger';

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot({
      load: [loadConfig],
      isGlobal: true,
    }),
    DatabaseModule.register({
      name: 'telos_docs',
      factory: loadDatabase,
    }),
  ],
  controllers: [
    AppController,
    PersonaTelosController,
    ProjectTelosController,
    ProfileTelosController,
  ],
  providers: [
    AppService,
    PersonaTelosService,
    ProjectTelosService,
    ProfileTelosService,
  ],
})
export class AppModule {}

