/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';

import { AppModule } from './app/app.module';
import loadConfig from './config';

async function bootstrap() {
  // Do not spin up a temporary Nest application just to read configuration:
  // lifecycle hooks on that context would start a second processing queue.
  const port = loadConfig().listenPort || 3016;
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: port,
      },
    }
  );

  await app.listen();
  Logger.log(`🚀 Video service is running on: ${port}`);
}

bootstrap();
