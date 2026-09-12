/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const configApp = await NestFactory.createApplicationContext(AppModule);
  const config = configApp.get(ConfigService);
  const port = Number(config.get('listenPort')) || 3024;
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: { host: '0.0.0.0', port },
    }
  );
  await app.listen();
  Logger.log(`Workspace microservice is listening on port ${port}`);
}

bootstrap();
