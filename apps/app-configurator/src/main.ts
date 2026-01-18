/**
 * App Configurator Microservice
 * Manages application configurations for multi-tenant configurable web clients
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app/app.module';
import loadConfig from './config';

async function bootstrap() {
  const logger = new Logger('AppConfigurator');
  const config = loadConfig();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: config.listenPort,
      },
    }
  );

  await app.listen();
  logger.log(
    `🚀 App Configurator Microservice is listening on port ${config.listenPort}`
  );
}

bootstrap();
