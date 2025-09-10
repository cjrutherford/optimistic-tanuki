/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app/app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const configApp = await NestFactory.create(AppModule);
  const configService = configApp.get(ConfigService);
  const port = configService.get<number>('listenPort') || 3008;
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.TCP,
    options: {
      host: "0.0.0.0",
      port: port,
    },
  });
  await app.listen();
  Logger.log(`🚀 Microservice is running on: tcp://localhost:${port}`);
}

bootstrap();
