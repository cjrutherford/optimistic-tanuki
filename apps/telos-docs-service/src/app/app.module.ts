import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { loadConfig } from './config';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { ProjectTelosController } from './project-telos/project-telos.controller';
import { ProfileTelosController } from './profile-telos/profile-telos.controller';
import { PersonaTelosService } from './persona-telos/persona-telos.service';
import { ProjectTelosService } from './project-telos/project-telos.service';
import { ProfileTelosService } from './profile-telos/profile-telos.service';
import loadDatabase from './database';
import { PersonaTelosController } from './persona-telos/persona-telos.controller';
import { PersonaTelos, ProfileTelos } from './entities';
import { DataSource } from 'typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [loadConfig],
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
    {
      provide: getRepositoryToken(ProfileTelos),
      useFactory: (dataSource: DataSource) => dataSource.getRepository(ProfileTelos),
      inject: ['TELOS_DOCS_CONNECTION']
    },
    {
      provide: getRepositoryToken(PersonaTelos),
      useFactory: (dataSource: DataSource) => dataSource.getRepository(PersonaTelos),
      inject: ['TELOS_DOCS_CONNECTION']
    },
    {
      provide: getRepositoryToken(ProfileTelos),
      useFactory: (dataSource: DataSource) => dataSource.getRepository(ProfileTelos),
      inject: ['TELOS_DOCS_CONNECTION']
    }
  ],
})
export class AppModule {}

