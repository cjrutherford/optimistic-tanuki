import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';
import loadConfig from './config';

async function bootstrap() {
  const port = loadConfig().listenPort || 3021;

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port,
      },
    }
  );

  await app.listen();
  Logger.log(
    `System Configurator API microservice is listening on port ${port}`
  );
}

bootstrap();
