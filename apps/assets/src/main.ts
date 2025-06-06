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
  const configApp = await NestFactory.create(AppModule);
  const config = configApp.get(ConfigService)
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: Number(config.get('listenPort')) || 3005,
    },
  });
  await app.listen().then(() => {
    Logger.log('Microservice is listening On Port: ' + config.get('listenPort') || 3005);
  });
}

bootstrap();
