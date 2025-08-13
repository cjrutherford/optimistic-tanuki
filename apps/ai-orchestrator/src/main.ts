import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  // Create the application context first
  const appContext = await NestFactory.createApplicationContext(AppModule);

  // Get ConfigService from the context
  const configService = appContext.get(ConfigService);
  const listenPort = configService.get<number>('listenPort') || 3010;

  // Now create the microservice using the config value
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: listenPort,
    },
  });

  await app.listen();
  Logger.log(
    `🚀 Microservice is running on: tcp://localhost:${listenPort}`
  );
}

bootstrap();
