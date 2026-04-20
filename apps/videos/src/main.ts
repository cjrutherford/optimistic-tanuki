/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';

import { AppModule } from './app/app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const configApp = await NestFactory.createApplicationContext(AppModule);
  const config = configApp.get(ConfigService);
  const port = config.get<number>('listenPort') || 3016;
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
  Logger.log(
    `🚀 Video service is running on: ${port}`
  );
}

bootstrap();
