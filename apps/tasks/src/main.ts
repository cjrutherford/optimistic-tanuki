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
  const config = (await NestFactory.createApplicationContext(AppModule)).get(ConfigService);
  const app = await NestFactory.createMicroservice(AppModule, {
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: config.get('listenPort') || 3004,
    }
  });
  app.listen().then(() => {
    Logger.log('Microservice is listening On Port: ' + config.get('listenPort') || 3004);
});
}

bootstrap();
