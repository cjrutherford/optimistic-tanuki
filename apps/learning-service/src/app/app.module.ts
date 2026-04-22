import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService, InMemoryLearningRepository } from './app.service';
import { LEARNING_REPOSITORY } from './learning.repository';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    AppService,
    InMemoryLearningRepository,
    {
      provide: LEARNING_REPOSITORY,
      useExisting: InMemoryLearningRepository,
    },
  ],
})
export class AppModule {}
