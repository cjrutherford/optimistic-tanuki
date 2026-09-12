import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { DataSource } from 'typeorm';
import loadConfig from '../config';
import { Workspace } from '../entities/workspace.entity';
import { AppController } from './app.controller';
import loadDatabase from './loadDatabase';
import { WorkspaceService } from './services/workspace.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [loadConfig] }),
    DatabaseModule.register({ name: 'workspace', factory: loadDatabase }),
  ],
  controllers: [AppController],
  providers: [
    WorkspaceService,
    {
      provide: getRepositoryToken(Workspace),
      useFactory: (dataSource: DataSource) =>
        dataSource.getRepository(Workspace),
      inject: ['WORKSPACE_CONNECTION'],
    },
  ],
})
export class AppModule {}
