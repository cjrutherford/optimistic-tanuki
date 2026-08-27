/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: Number(config.get('listenPort')) || 3005,
    },
  });
  await app.startAllMicroservices();
  const mediaPort = Number(config.get('internalMediaPort')) || 3006;
  await app.listen(mediaPort, '0.0.0.0');
  Logger.log(
    `Assets TCP microservice is listening on port ${
      config.get('listenPort') || 3005
    }`
  );
  Logger.log(
    `Assets internal media HTTP server is listening on port ${mediaPort}`
  );
}

bootstrap();
