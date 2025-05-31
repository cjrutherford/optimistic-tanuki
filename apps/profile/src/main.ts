/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';
import { Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const configApp = await NestFactory.createApplicationContext(AppModule);
  const config = configApp.get(ConfigService);
  const app = await NestFactory.createMicroservice(AppModule, {
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: config.get('listenPort') || 3002,
    }
  });
  app.listen().then(() => {
    Logger.log('Microservice is listening On Port: ' + config.get('listenPort') || 3002);
  });
}

bootstrap();
