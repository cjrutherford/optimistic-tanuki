/**
 * App Configurator Microservice
 * Manages application configurations for multi-tenant configurable web clients
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const logger = new Logger('AppConfigurator');
  
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: process.env.PORT || 3010,
      },
    }
  );

  await app.listen();
  logger.log(`🚀 App Configurator Microservice is listening on port ${process.env.PORT || 3010}`);
}

bootstrap();
