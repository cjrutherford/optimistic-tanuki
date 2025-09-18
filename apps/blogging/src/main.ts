/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const configApp = await NestFactory.createApplicationContext(AppModule);
  const logger = await configApp.get(Logger);
  const configService = configApp.get(ConfigService);
  const port = configService.get<number>('listenPort', 3011);
  logger.log(`🚀 Starting blogging service on port ${port}`);
  await configApp.close();
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
  logger.log(`🚀 Blogging service is listening on port ${port}`);
}

bootstrap();
