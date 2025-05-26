import { Module } from '@nestjs/common';
import { DatabaseModule } from '@optimistic-tanuki/database';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import loadDatabase from '../loadDatabase';
import loadConfig from '../config';
import { NoteEntity, TaskEntity, TimerEntity } from '../entities';
import { DataSource } from 'typeorm';
import { TasksService, TimersService, NotesService } from '../services';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadConfig]
    }),
    DatabaseModule.register({
      name: 'tasks',
      factory: loadDatabase,
    })
  ],
  controllers: [AppController],
  providers: [
    AppService,
    TasksService,
    TimersService,
    NotesService,
    {
      provide: getRepositoryToken(TaskEntity),
      useFactory: (ds: DataSource) => ds.getRepository(TaskEntity),
      inject: ['TASKS_CONNECTION']
    },{
      provide: getRepositoryToken(NoteEntity),
      useFactory: (ds: DataSource) => ds.getRepository(NoteEntity),
      inject: ['TASKS_CONNECTION']
    },{
      provide: getRepositoryToken(TimerEntity),
      useFactory: (ds: DataSource) => ds.getRepository(TimerEntity),
      inject: ['TASKS_CONNECTION']
    }
  ],
})
export class AppModule {}
