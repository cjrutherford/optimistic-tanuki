import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import loadConfig from './config';

async function bootstrap() {
  const config = loadConfig();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: Number(config.listenPort) || 3020,
      },
    }
  );

  await app.listen().then(() => {
    Logger.log(
      'Lead Tracker microservice listening on port: ' +
        (config.listenPort || 3020)
    );
  });
}

bootstrap();
